// src/components/subscriptions/subscription-detail.constants.ts
import type { BillingCycle, SubscriptionStatus } from "@prisma/client";

export function getStatusLabels(
  t: (key: string) => string
): Record<SubscriptionStatus, string> {
  return {
    ACTIVE: t("subscriptions.status.active"),
    EXPIRED: t("subscriptions.status.expired"),
    CANCELLED: t("subscriptions.status.cancelled"),
    PENDING: t("subscriptions.status.pending"),
    PAUSED: t("subscriptions.status.paused"),
    ARCHIVED: t("subscriptions.status.archived"),
  };
}

export const statusVariants: Record<
  SubscriptionStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  EXPIRED: "destructive",
  CANCELLED: "destructive",
  PENDING: "outline",
  PAUSED: "secondary",
  ARCHIVED: "outline",
};

/**
 * Semantic status colours (light + dark). Used for badges and the status strip
 * on the detail page so PAUSED/ARCHIVED read differently from ACTIVE/CANCELLED.
 */
export const statusToneClasses: Record<SubscriptionStatus, string> = {
  ACTIVE: "border-transparent bg-success/15 text-success",
  PENDING: "border-transparent bg-warning/15 text-warning",
  PAUSED: "border-transparent bg-info/15 text-info",
  EXPIRED: "border-transparent bg-error/15 text-error",
  CANCELLED: "border-transparent bg-error/15 text-error",
  ARCHIVED: "border-transparent bg-neutral/15 text-neutral",
};

export function getBillingCycleLabels(
  t: (key: string) => string
): Record<BillingCycle, string> {
  return {
    MONTHLY: t("subscriptions.billingCycle.monthly"),
    QUARTERLY: t("subscriptions.billingCycle.quarterly"),
    YEARLY: t("subscriptions.billingCycle.yearly"),
    ONE_TIME: t("subscriptions.billingCycle.oneTime"),
  };
}
