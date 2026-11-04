// src/actions/approvals/export.ts
"use server";

/**
 * Feature 2.8 — CSV export of approval history (requires `approvals:export`).
 */
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import { recordAudit } from "@/lib/services/approval/audit";
import { generateCSV, type CSVColumn } from "@/lib/services/export/csv";
import { approvalListFiltersSchema } from "@/lib/validations/approvals";
import type { ActionState } from "@/types";
import type { Prisma } from "@prisma/client";
import { USER_REF_SELECT, runAction } from "./shared";

/** Hard cap so an export never streams the whole table into memory. */
const EXPORT_ROW_LIMIT = 5000;

const EXPORT_INCLUDE = {
  requester: { select: USER_REF_SELECT },
  category: { select: { name: true } },
  costCenter: { select: { code: true, name: true } },
  policy: { select: { name: true } },
  steps: {
    orderBy: { stepOrder: "asc" as const },
    include: { approver: { select: USER_REF_SELECT } },
  },
} satisfies Prisma.ApprovalRequestInclude;

type ExportRow = Prisma.ApprovalRequestGetPayload<{
  include: typeof EXPORT_INCLUDE;
}>;

interface ExportRecord {
  id: string;
  serviceName: string;
  requester: string;
  status: string;
  amount: number;
  currency: string;
  billingCycle: string;
  monthlyAmount: number;
  seats: number | null;
  category: string;
  costCenter: string;
  policy: string;
  approvers: string;
  submittedAt: string;
  decidedAt: string;
  justification: string;
}

function toRecord(row: ExportRow): ExportRecord {
  return {
    id: row.id,
    serviceName: row.serviceName,
    requester: row.requester.name ?? row.requester.email,
    status: row.status,
    amount: Number(row.amount),
    currency: row.currency,
    billingCycle: row.billingCycle,
    monthlyAmount: Number(row.monthlyAmount),
    seats: row.seats,
    category: row.category?.name ?? "",
    costCenter: row.costCenter
      ? `${row.costCenter.code} ${row.costCenter.name}`
      : "",
    policy: row.policy?.name ?? "",
    approvers: row.steps
      .filter((s) => s.status === "APPROVED" || s.status === "REJECTED")
      .map(
        (s) =>
          `${s.label}: ${s.approver.name ?? s.approver.email} (${s.status})`
      )
      .join("; "),
    submittedAt: row.submittedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? "",
    justification: row.justification,
  };
}

const COLUMNS: CSVColumn<ExportRecord>[] = [
  { key: "id", header: "Request ID" },
  { key: "serviceName", header: "Service" },
  { key: "requester", header: "Requester" },
  { key: "status", header: "Status" },
  { key: "amount", header: "Amount" },
  { key: "currency", header: "Currency" },
  { key: "billingCycle", header: "Billing cycle" },
  { key: "monthlyAmount", header: "Monthly amount" },
  { key: "seats", header: "Seats" },
  { key: "category", header: "Category" },
  { key: "costCenter", header: "Cost centre" },
  { key: "policy", header: "Policy" },
  { key: "approvers", header: "Approvers" },
  { key: "submittedAt", header: "Submitted at" },
  { key: "decidedAt", header: "Decided at" },
  { key: "justification", header: "Justification" },
];

export interface ApprovalExportResult {
  csv: string;
  filename: string;
  rowCount: number;
}

async function _exportApprovals(
  rawFilters: unknown = {}
): Promise<ActionState<ApprovalExportResult>> {
  return runAction("exportApprovals", async () => {
    const { organizationId, userId } =
      await requirePermission("approvals:export");
    const parsed = approvalListFiltersSchema.safeParse(rawFilters ?? {});
    const f = parsed.success
      ? parsed.data
      : approvalListFiltersSchema.parse({});
    const where: Prisma.ApprovalRequestWhereInput = { organizationId };
    if (f.status) where.status = f.status;
    if (f.requesterId) where.requesterId = f.requesterId;
    if (f.categoryId) where.categoryId = f.categoryId;
    if (f.dateFrom || f.dateTo) {
      where.submittedAt = {
        ...(f.dateFrom ? { gte: new Date(f.dateFrom) } : {}),
        ...(f.dateTo ? { lte: new Date(f.dateTo) } : {}),
      };
    }
    const rows = await prisma.approvalRequest.findMany({
      where,
      include: EXPORT_INCLUDE,
      orderBy: { submittedAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const csv = generateCSV(COLUMNS, rows.map(toRecord), { includeBOM: true });
    await recordAudit(prisma, {
      organizationId,
      userId,
      action: "EXPORT_APPROVALS",
      entityType: "approval_request",
      entityId: organizationId,
      changes: { rowCount: rows.length, filters: f },
    });
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      success: true,
      data: { csv, filename: `approvals-${stamp}.csv`, rowCount: rows.length },
    };
  });
}
export const exportApprovals = withLogging("exportApprovals", _exportApprovals);
