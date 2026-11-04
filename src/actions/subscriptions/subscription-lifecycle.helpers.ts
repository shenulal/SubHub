// src/actions/subscriptions/subscription-lifecycle.helpers.ts
/**
 * Pure helpers for subscription status transitions. Kept free of I/O so the
 * transition table can be unit-tested directly.
 */
import { isForbiddenError } from "@/lib/rbac/service";
import type { ActionState } from "@/types";
import type { SubscriptionStatus } from "@prisma/client";

export type LifecycleAction =
  | "pause"
  | "resume"
  | "archive"
  | "restore"
  | "cancel";

export const LIFECYCLE_AUDIT_ACTION: Record<LifecycleAction, string> = {
  pause: "PAUSE_SUBSCRIPTION",
  resume: "RESUME_SUBSCRIPTION",
  archive: "ARCHIVE_SUBSCRIPTION",
  restore: "RESTORE_SUBSCRIPTION",
  cancel: "CANCEL_SUBSCRIPTION",
};

const ALLOWED_FROM: Record<LifecycleAction, readonly SubscriptionStatus[]> = {
  pause: ["ACTIVE"],
  resume: ["PAUSED"],
  archive: ["ACTIVE", "PAUSED", "CANCELLED", "EXPIRED", "PENDING"],
  restore: ["ARCHIVED"],
  cancel: ["ACTIVE", "PAUSED", "PENDING"],
};

export function canTransition(
  action: LifecycleAction,
  from: SubscriptionStatus
): boolean {
  return ALLOWED_FROM[action].includes(from);
}

export interface TransitionContext {
  /** Status before archiving (read from the archive audit entry). */
  previousStatus?: SubscriptionStatus | null;
  /** Effective cancellation date. */
  effectiveDate?: Date | null;
  now: Date;
}

export interface TransitionPatch {
  status: SubscriptionStatus;
  pausedAt?: Date | null;
  archivedAt?: Date | null;
  endDate?: Date | null;
  autoRenewal?: boolean;
}

/** Column patch for a given transition. Callers check `canTransition` first. */
export function buildTransitionPatch(
  action: LifecycleAction,
  ctx: TransitionContext
): TransitionPatch {
  switch (action) {
    case "pause":
      return { status: "PAUSED", pausedAt: ctx.now };
    case "resume":
      return { status: "ACTIVE", pausedAt: null };
    case "archive":
      return { status: "ARCHIVED", archivedAt: ctx.now };
    case "restore": {
      const previous = ctx.previousStatus ?? "ACTIVE";
      const target: SubscriptionStatus =
        previous === "ARCHIVED" ? "ACTIVE" : previous;
      return {
        status: target,
        archivedAt: null,
        pausedAt: target === "PAUSED" ? ctx.now : null,
      };
    }
    case "cancel":
      return {
        status: "CANCELLED",
        endDate: ctx.effectiveDate ?? ctx.now,
        autoRenewal: false,
        pausedAt: null,
      };
  }
}

export const LIFECYCLE_ERRORS = {
  notFound: "Subscription not found",
  invalidTransition: "This status change is not allowed for the subscription",
  forbidden: "You do not have permission to perform this action",
  generic: "The subscription could not be updated",
  noIds: "Select at least one subscription",
  invalidInput: "Invalid input",
} as const;

export function toActionError<T = null>(
  error: unknown,
  fallback: string = LIFECYCLE_ERRORS.generic
): ActionState<T> {
  if (isForbiddenError(error)) {
    return { success: false, error: LIFECYCLE_ERRORS.forbidden };
  }
  return { success: false, error: fallback };
}

/** Next.js redirect/notFound errors must propagate out of server actions. */
export function isNextNavigationError(error: unknown): boolean {
  if (!(error instanceof Error) || !("digest" in error)) return false;
  const digest = (error as { digest?: unknown }).digest;
  return (
    typeof digest === "string" &&
    (digest.includes("NEXT_REDIRECT") || digest.includes("NEXT_NOT_FOUND"))
  );
}
