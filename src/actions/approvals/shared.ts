// src/actions/approvals/shared.ts
/**
 * Helpers shared by the approval server actions: error mapping to ActionState
 * and Prisma → view-model serialisation (Decimal/Date → number/ISO string).
 */
import { logger } from "@/lib/logger";
import { isForbiddenError } from "@/lib/rbac/service";
import {
  candidatesForStep,
  isApprovalError,
} from "@/lib/services/approval/shared";
import type { ActionState } from "@/types";
import type {
  ApprovalDecisionSummary,
  ApprovalEventView,
  ApprovalRequestListItem,
  ApprovalRequestMetadata,
  ApprovalStepView,
  ApprovalUserRef,
} from "@/types/approval";
import type { Prisma } from "@prisma/client";

export const USER_REF_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
} satisfies Prisma.UserSelect;

export const LIST_INCLUDE = {
  requester: { select: USER_REF_SELECT },
  category: { select: { id: true, name: true } },
  steps: {
    orderBy: { stepOrder: "asc" as const },
    include: { approver: { select: USER_REF_SELECT } },
  },
} satisfies Prisma.ApprovalRequestInclude;

export type ListRow = Prisma.ApprovalRequestGetPayload<{
  include: typeof LIST_INCLUDE;
}>;

function isNextRedirect(error: unknown): boolean {
  const digest = (error as { digest?: string } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

export async function runAction<T>(
  name: string,
  fn: () => Promise<ActionState<T>>
): Promise<ActionState<T>> {
  try {
    return await fn();
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (isForbiddenError(error)) {
      return { success: false, error: error.message, message: "FORBIDDEN" };
    }
    if (isApprovalError(error)) {
      return { success: false, error: error.message, message: error.code };
    }
    logger.error({ err: error, action: name }, "[approvals] action failed");
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      message: "UNEXPECTED",
    };
  }
}

export function metadataOf(row: {
  metadata: unknown;
}): ApprovalRequestMetadata {
  const raw = row.metadata;
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as ApprovalRequestMetadata)
    : {};
}

export function isAwaitingUser(row: ListRow, userId: string): boolean {
  if (row.status !== "PENDING") return false;
  const current = row.steps.find((s) => s.stepOrder === row.currentStep);
  if (!current || current.status !== "PENDING") return false;
  if (metadataOf(row).candidateIds?.includes(userId)) return true;
  return candidatesForStep(row, current).includes(userId);
}

/** Who is looking: drives `canDecide` on every row (same rule as the service). */
export interface ListViewer {
  userId: string;
  isAdmin: boolean;
  hasDecidePermission: boolean;
}

export function viewerCanDecide(row: ListRow, viewer: ListViewer): boolean {
  if (!viewer.hasDecidePermission || row.status !== "PENDING") return false;
  const current = row.steps.find((s) => s.stepOrder === row.currentStep);
  if (!current || current.status !== "PENDING") return false;
  return viewer.isAdmin || isAwaitingUser(row, viewer.userId);
}

export function toListItem(
  row: ListRow,
  viewerOrUserId: ListViewer | string
): ApprovalRequestListItem {
  const viewer: ListViewer =
    typeof viewerOrUserId === "string"
      ? { userId: viewerOrUserId, isAdmin: false, hasDecidePermission: false }
      : viewerOrUserId;
  const userId = viewer.userId;
  const current = row.steps.find((s) => s.stepOrder === row.currentStep);
  return {
    id: row.id,
    serviceName: row.serviceName,
    vendorWebsite: row.vendorWebsite,
    amount: Number(row.amount),
    currency: row.currency,
    billingCycle: row.billingCycle,
    monthlyAmount: Number(row.monthlyAmount),
    seats: row.seats,
    status: row.status,
    currentStep: row.currentStep,
    totalSteps: row.steps.length,
    submittedAt: row.submittedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    requester: row.requester,
    category: row.category,
    costCenterId: row.costCenterId,
    currentApprover:
      row.status === "PENDING" || row.status === "INFO_REQUESTED"
        ? (current?.approver ?? null)
        : null,
    isAwaitingMe: isAwaitingUser(row, userId),
    canDecide: viewerCanDecide(row, viewer),
  };
}

type DecisionRow = Pick<ListRow, "status" | "decidedAt"> & {
  steps: Pick<ListRow["steps"][number], "status" | "comment" | "approver">[];
  rejectionReasonId: string | null;
  rejectionReasonName: string | null;
  decisionComment: string | null;
  decisionConditions: string | null;
  effectiveStartDate: Date | null;
};

/** Latest approve / reject outcome, or null while the request is undecided. */
export function toDecisionSummary(
  row: DecisionRow
): ApprovalDecisionSummary | null {
  if (row.status !== "APPROVED" && row.status !== "REJECTED") return null;
  const decided = [...row.steps]
    .reverse()
    .find((s) => s.status === "APPROVED" || s.status === "REJECTED");
  const reasonName = row.rejectionReasonName;
  return {
    status: row.status,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decidedBy: decided?.approver ?? null,
    comment: row.decisionComment ?? decided?.comment ?? null,
    conditions: row.decisionConditions,
    reason: reasonName ? { id: row.rejectionReasonId, name: reasonName } : null,
    effectiveStartDate: row.effectiveStartDate
      ? row.effectiveStartDate.toISOString().slice(0, 10)
      : null,
  };
}

export function toStepView(
  step: ListRow["steps"][number],
  candidates: ApprovalUserRef[]
): ApprovalStepView {
  return {
    id: step.id,
    stepOrder: step.stepOrder,
    label: step.label,
    status: step.status,
    comment: step.comment,
    dueAt: step.dueAt?.toISOString() ?? null,
    decidedAt: step.decidedAt?.toISOString() ?? null,
    approver: step.approver,
    candidates,
  };
}

export function toEventView(event: {
  id: string;
  type: ApprovalEventView["type"];
  comment: string | null;
  metadata: unknown;
  createdAt: Date;
  actor: ApprovalUserRef | null;
}): ApprovalEventView {
  return {
    id: event.id,
    type: event.type,
    comment: event.comment,
    metadata:
      event.metadata && typeof event.metadata === "object"
        ? (event.metadata as Record<string, unknown>)
        : null,
    createdAt: event.createdAt.toISOString(),
    actor: event.actor,
  };
}
