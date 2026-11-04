// src/actions/approvals/shared.ts
/**
 * Helpers shared by the approval server actions: error mapping to ActionState
 * and Prisma → view-model serialisation (Decimal/Date → number/ISO string).
 */
import { logger } from "@/lib/logger";
import { isForbiddenError } from "@/lib/rbac/service";
import { isApprovalError } from "@/lib/services/approval/shared";
import type { ActionState } from "@/types";
import type {
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
  if (current?.approverId === userId) return true;
  return metadataOf(row).candidateIds?.includes(userId) ?? false;
}

export function toListItem(
  row: ListRow,
  userId: string
): ApprovalRequestListItem {
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
    currentApprover:
      row.status === "PENDING" || row.status === "INFO_REQUESTED"
        ? (current?.approver ?? null)
        : null,
    isAwaitingMe: isAwaitingUser(row, userId),
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
