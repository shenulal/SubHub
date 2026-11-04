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
  ACTIVE:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  PENDING: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  PAUSED:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  EXPIRED: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  CANCELLED:
    "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  ARCHIVED: "border-border bg-muted text-muted-foreground",
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
