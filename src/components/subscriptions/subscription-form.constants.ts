// src/components/subscriptions/subscription-form.constants.ts

export function getBillingTypeOptions(t: (key: string) => string) {
  return [
    { value: "FLAT_RATE", label: t("subscriptions.billingType.flatRate") },
    { value: "PER_SEAT", label: t("subscriptions.billingType.perSeat") },
  ] as const;
}

export function getBillingCycleOptions(t: (key: string) => string) {
  return [
    { value: "MONTHLY", label: t("subscriptions.billingCycle.monthly") },
    { value: "QUARTERLY", label: t("subscriptions.billingCycle.quarterly") },
    { value: "YEARLY", label: t("subscriptions.billingCycle.yearly") },
    { value: "ONE_TIME", label: t("subscriptions.billingCycle.oneTime") },
  ] as const;
}

export function getStatusOptions(t: (key: string) => string) {
  return [
    { value: "ACTIVE", label: t("subscriptions.status.active") },
    { value: "PENDING", label: t("subscriptions.status.pending") },
    { value: "EXPIRED", label: t("subscriptions.status.expired") },
    { value: "CANCELLED", label: t("subscriptions.status.cancelled") },
  ] as const;
}

/**
 * Convert a Date object to a string for input[type="date"]
 */
export function formatDateForInput(date: Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}
