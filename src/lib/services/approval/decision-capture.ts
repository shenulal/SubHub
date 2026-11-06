// src/lib/services/approval/decision-capture.ts
/**
 * Decision capture: normalises what an approver enters with a decision and
 * checks every referenced master (cost centre, category, rejection reason)
 * belongs to the organisation and is active. Results feed the step comment,
 * the timeline event, the request's decision columns and the audit log.
 */
import { ApprovalError, type Db, type LoadedRequest } from "./shared";

export interface ApproveCapture {
  comment: string | null;
  conditions: string | null;
  costCenterId: string | null;
  categoryId: string | null;
  /** Start date for the subscription created on final approval. */
  effectiveStartDate: Date | null;
}

export interface RejectCapture {
  reasonId: string | null;
  comment: string;
}

export interface Assignment {
  from: string | null;
  to: string;
  label: string;
}

export interface ResolvedApprove extends ApproveCapture {
  costCenter: Assignment | null;
  category: Assignment | null;
}

export interface ResolvedReject {
  comment: string;
  reason: { id: string; name: string } | null;
}

/** Accepts the legacy `comment` argument or the full capture object. */
export function toApproveCapture(
  input: string | null | undefined | Partial<ApproveCapture>
): ApproveCapture {
  if (input === null || input === undefined || typeof input === "string") {
    return {
      comment: input?.trim() || null,
      conditions: null,
      costCenterId: null,
      categoryId: null,
      effectiveStartDate: null,
    };
  }
  return {
    comment: input.comment?.trim() || null,
    conditions: input.conditions?.trim() || null,
    costCenterId: input.costCenterId || null,
    categoryId: input.categoryId || null,
    effectiveStartDate: input.effectiveStartDate ?? null,
  };
}

export function toRejectCapture(
  input: string | Partial<RejectCapture>
): RejectCapture {
  if (typeof input === "string") return { reasonId: null, comment: input };
  return { reasonId: input.reasonId || null, comment: input.comment ?? "" };
}

async function resolveCostCenter(
  db: Db,
  request: LoadedRequest,
  id: string | null
): Promise<Assignment | null> {
  if (!id || id === request.costCenterId) return null;
  const row = await db.costCenter.findFirst({
    where: { id, organizationId: request.organizationId, isActive: true },
    select: { id: true, code: true, name: true },
  });
  if (!row) {
    throw new ApprovalError("INVALID_INPUT", "Cost centre not found");
  }
  return {
    from: request.costCenterId,
    to: row.id,
    label: `${row.code} · ${row.name}`,
  };
}

async function resolveCategory(
  db: Db,
  request: LoadedRequest,
  id: string | null
): Promise<Assignment | null> {
  if (!id || id === request.categoryId) return null;
  const row = await db.category.findFirst({
    where: { id, organizationId: request.organizationId, isArchived: false },
    select: { id: true, name: true },
  });
  if (!row) throw new ApprovalError("INVALID_INPUT", "Category not found");
  return { from: request.categoryId, to: row.id, label: row.name };
}

export async function resolveApproveCapture(
  db: Db,
  request: LoadedRequest,
  capture: ApproveCapture
): Promise<ResolvedApprove> {
  const [costCenter, category] = await Promise.all([
    resolveCostCenter(db, request, capture.costCenterId),
    resolveCategory(db, request, capture.categoryId),
  ]);
  return { ...capture, costCenter, category };
}

export async function resolveRejectCapture(
  db: Db,
  organizationId: string,
  capture: RejectCapture
): Promise<ResolvedReject> {
  const comment = capture.comment.trim();
  if (!comment) {
    throw new ApprovalError("INVALID_INPUT", "A comment is required to reject");
  }
  if (!capture.reasonId) return { comment, reason: null };
  const reason = await db.approvalRejectionReason.findFirst({
    where: { id: capture.reasonId, organizationId, isActive: true },
    select: { id: true, name: true },
  });
  if (!reason) {
    throw new ApprovalError("INVALID_INPUT", "Rejection reason not found");
  }
  return { comment, reason };
}

/** Event / audit metadata for an approval (only the fields that were set). */
export function approveEventMetadata(
  resolved: ResolvedApprove
): Record<string, unknown> {
  return {
    ...(resolved.conditions ? { conditions: resolved.conditions } : {}),
    ...(resolved.effectiveStartDate
      ? { effectiveStartDate: toDateOnly(resolved.effectiveStartDate) }
      : {}),
    ...(resolved.costCenter ? { costCenter: resolved.costCenter } : {}),
    ...(resolved.category ? { category: resolved.category } : {}),
  };
}

/**
 * Request columns written by an approval step. Conditions accumulate across
 * steps (prefixed with the step label when the chain has several steps).
 */
export function approveRequestColumns(
  request: Pick<LoadedRequest, "decisionConditions" | "steps">,
  resolved: ResolvedApprove,
  stepLabel: string
) {
  const line =
    resolved.conditions && request.steps.length > 1
      ? `${stepLabel}: ${resolved.conditions}`
      : resolved.conditions;
  const conditions = line
    ? [request.decisionConditions, line].filter(Boolean).join("\n")
    : request.decisionConditions;
  return {
    decisionComment: resolved.comment,
    decisionConditions: conditions ?? null,
    ...(resolved.effectiveStartDate
      ? { effectiveStartDate: resolved.effectiveStartDate }
      : {}),
    ...(resolved.costCenter ? { costCenterId: resolved.costCenter.to } : {}),
    ...(resolved.category ? { categoryId: resolved.category.to } : {}),
  };
}

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parses `YYYY-MM-DD` as a UTC calendar date (stored in a DATE column). */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
