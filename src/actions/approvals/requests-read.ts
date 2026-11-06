// src/actions/approvals/requests-read.ts
"use server";

/**
 * Feature 2.5 — inbox list (To review / My requests / All) and request detail.
 */
import { prisma } from "@/lib/db";
import { inFilter } from "@/lib/filters/multi-value";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import { isAdminRole } from "@/lib/services/approval/shared";
import { approvalListFiltersSchema } from "@/lib/validations/approvals";
import type { ActionState } from "@/types";
import type {
  ApprovalInboxTab,
  ApprovalRequestDetail,
  ApprovalRequestListItem,
  ApprovalUserRef,
} from "@/types/approval";
import type { Prisma } from "@prisma/client";
import {
  LIST_INCLUDE,
  metadataOf,
  runAction,
  toDecisionSummary,
  toEventView,
  toListItem,
  toStepView,
  USER_REF_SELECT,
} from "./shared";

export interface ApprovalListResult {
  items: ApprovalRequestListItem[];
  total: number;
  page: number;
  limit: number;
  tab: ApprovalInboxTab;
  counts: { toReview: number; mine: number; all: number | null };
}

function awaitingUserWhere(userId: string): Prisma.ApprovalRequestWhereInput {
  return {
    OR: [
      { steps: { some: { approverId: userId, status: "PENDING" } } },
      { metadata: { path: ["candidateIds"], array_contains: [userId] } },
    ],
  };
}

function tabWhere(
  tab: ApprovalInboxTab,
  userId: string,
  canReadAll: boolean
): Prisma.ApprovalRequestWhereInput {
  if (tab === "all" && canReadAll) return {};
  if (tab === "to_review") return awaitingUserWhere(userId);
  return { requesterId: userId };
}

function buildWhere(
  organizationId: string,
  userId: string,
  canReadAll: boolean,
  f: ReturnType<typeof approvalListFiltersSchema.parse>
): Prisma.ApprovalRequestWhereInput {
  const where: Prisma.ApprovalRequestWhereInput = {
    organizationId,
    ...tabWhere(f.tab, userId, canReadAll),
  };
  const statuses = inFilter(f.statuses);
  const requesters = inFilter(f.requesterIds);
  const categories = inFilter(f.categoryIds);
  if (statuses) where.status = statuses;
  else if (f.tab === "to_review") where.status = "PENDING";
  if (requesters) where.requesterId = requesters;
  if (categories) where.categoryId = categories;
  if (f.dateFrom || f.dateTo) {
    where.submittedAt = {
      ...(f.dateFrom ? { gte: new Date(f.dateFrom) } : {}),
      ...(f.dateTo ? { lte: new Date(f.dateTo) } : {}),
    };
  }
  if (f.search) {
    where.serviceName = { contains: f.search, mode: "insensitive" };
  }
  return where;
}

async function _getApprovalRequests(
  rawFilters: unknown = {}
): Promise<ActionState<ApprovalListResult>> {
  return runAction("getApprovalRequests", async () => {
    const { organizationId, userId, role, permissions } =
      await requirePermission("approvals:read");
    const parsed = approvalListFiltersSchema.safeParse(rawFilters ?? {});
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid filters",
        errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const f = parsed.data;
    const canReadAll = permissions.has("approvals:read_all");
    const tab: ApprovalInboxTab =
      f.tab === "all" && !canReadAll ? "mine" : f.tab;
    const where = buildWhere(organizationId, userId, canReadAll, { ...f, tab });
    const [rows, total, toReview, mine, all] = await Promise.all([
      prisma.approvalRequest.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { [f.sortBy]: f.sortOrder },
        skip: (f.page - 1) * f.limit,
        take: f.limit,
      }),
      prisma.approvalRequest.count({ where }),
      prisma.approvalRequest.count({
        where: {
          organizationId,
          status: "PENDING",
          ...awaitingUserWhere(userId),
        },
      }),
      prisma.approvalRequest.count({
        where: {
          organizationId,
          requesterId: userId,
          status: { in: ["PENDING", "INFO_REQUESTED"] },
        },
      }),
      canReadAll
        ? prisma.approvalRequest.count({
            where: {
              organizationId,
              status: { in: ["PENDING", "INFO_REQUESTED"] },
            },
          })
        : Promise.resolve(null),
    ]);
    return {
      success: true,
      data: {
        items: rows.map((r) =>
          toListItem(r, {
            userId,
            isAdmin: isAdminRole(role),
            hasDecidePermission: permissions.has("approvals:decide"),
          })
        ),
        total,
        page: f.page,
        limit: f.limit,
        tab,
        counts: { toReview, mine, all },
      },
    };
  });
}
export const getApprovalRequests = withLogging(
  "getApprovalRequests",
  _getApprovalRequests
);

const DETAIL_INCLUDE = {
  ...LIST_INCLUDE,
  costCenter: { select: { id: true, code: true, name: true } },
  policy: { select: { id: true, name: true } },
  catalog: { select: { id: true, name: true, logoUrl: true } },
  events: {
    orderBy: { createdAt: "asc" as const },
    include: { actor: { select: USER_REF_SELECT } },
  },
} satisfies Prisma.ApprovalRequestInclude;

async function loadCandidates(
  organizationId: string,
  ids: string[]
): Promise<Map<string, ApprovalUserRef>> {
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, organizationId },
    select: USER_REF_SELECT,
  });
  return new Map(users.map((u) => [u.id, u]));
}

async function _getApprovalRequest(
  id: string
): Promise<ActionState<ApprovalRequestDetail>> {
  return runAction("getApprovalRequest", async () => {
    const { organizationId, userId, role, permissions } =
      await requirePermission("approvals:read");
    const row = await prisma.approvalRequest.findFirst({
      where: { id, organizationId },
      include: DETAIL_INCLUDE,
    });
    if (!row) return { success: false, error: "Approval request not found" };

    const meta = metadataOf(row);
    const candidateIds = Array.from(
      new Set(Object.values(meta.stepCandidates ?? {}).flat())
    );
    const isAdmin = isAdminRole(role);
    const isRequester = row.requesterId === userId;
    const isParticipant =
      isRequester ||
      row.steps.some((s) => s.approverId === userId) ||
      candidateIds.includes(userId) ||
      (meta.escalatedTo ?? []).includes(userId);
    if (!isParticipant && !isAdmin && !permissions.has("approvals:read_all")) {
      return { success: false, error: "You cannot view this request" };
    }

    const users = await loadCandidates(organizationId, candidateIds);
    const base = toListItem(row, {
      userId,
      isAdmin,
      hasDecidePermission: permissions.has("approvals:decide"),
    });
    return {
      success: true,
      data: {
        ...base,
        justification: row.justification,
        costCenter: row.costCenter,
        policy: row.policy,
        subscriptionId: row.subscriptionId,
        catalog: row.catalog,
        escalatedAt: row.escalatedAt?.toISOString() ?? null,
        lastReminderAt: row.lastReminderAt?.toISOString() ?? null,
        decision: toDecisionSummary(row),
        effectiveStartDate: row.effectiveStartDate
          ? row.effectiveStartDate.toISOString().slice(0, 10)
          : null,
        steps: row.steps.map((s) =>
          toStepView(
            s,
            (meta.stepCandidates?.[String(s.stepOrder)] ?? [])
              .map((cid) => users.get(cid))
              .filter((u): u is ApprovalUserRef => Boolean(u))
          )
        ),
        events: row.events.map(toEventView),
        viewer: {
          canDecide: base.canDecide,
          canProvideInfo: isRequester && row.status === "INFO_REQUESTED",
          canCancel:
            (isRequester || permissions.has("approvals:cancel_any")) &&
            (row.status === "PENDING" || row.status === "INFO_REQUESTED"),
          canComment:
            isParticipant || isAdmin || permissions.has("approvals:read_all"),
          isRequester,
        },
      },
    };
  });
}
export const getApprovalRequest = withLogging(
  "getApprovalRequest",
  _getApprovalRequest
);
