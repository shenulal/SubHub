// src/components/dashboard/dashboard-alerts.ts
/**
 * Pure builder for the dashboard alert banner items.
 */
import type { SubscriptionAnomalyItem } from "@/types/dashboard";

import type { DashboardAlertItem } from "./dashboard-alert-banner";

export interface DashboardAlertInputs {
  hasPaymentData?: boolean;
  terminatedWithSubCount?: number;
  suggestionCount?: number;
  subscriptionAnomalies?: SubscriptionAnomalyItem[];
}

export function buildDashboardAlerts(
  inputs: DashboardAlertInputs
): DashboardAlertItem[] {
  const alerts: DashboardAlertItem[] = [];
  if (inputs.hasPaymentData === false) {
    alerts.push({
      id: "no-payment-data",
      severity: "info",
      titleKey: "noPaymentData.title",
      messageKey: "noPaymentData.message",
      href: "/payments?tab=import",
    });
  }
  if (inputs.terminatedWithSubCount && inputs.terminatedWithSubCount > 0) {
    alerts.push({
      id: "terminated-with-subscriptions",
      severity: "warning",
      titleKey: "terminatedWithSub.title",
      messageKey: "terminatedWithSub.message",
      href: "/users/offboarded",
    });
  }
  if (inputs.suggestionCount && inputs.suggestionCount > 0) {
    alerts.push({
      id: "pending-subscriptions",
      severity: "warning",
      titleKey: "pendingSubscriptions.title",
      messageKey: "pendingSubscriptions.message",
      messageParams: { count: inputs.suggestionCount },
      href: "/subscriptions/suggestions",
    });
  }
  for (const anomaly of inputs.subscriptionAnomalies ?? []) {
    const isFlat = anomaly.billingType === "FLAT_RATE";
    alerts.push({
      id: `sub-anomaly-${anomaly.subscriptionId}`,
      severity: isFlat ? "warning" : "info",
      titleKey: isFlat ? "subAnomalyFlatRate.title" : "subAnomalyPerSeat.title",
      messageKey: isFlat
        ? "subAnomalyFlatRate.message"
        : "subAnomalyPerSeat.message",
      titleParams: { appName: anomaly.appName },
      ...(isFlat
        ? {}
        : {
            messageParams: {
              usedLicenses: anomaly.usedLicenses ?? 0,
              totalLicenses: anomaly.totalLicenses ?? 0,
            },
          }),
      href: `/subscriptions/${anomaly.subscriptionId}/edit`,
    });
  }
  return alerts;
}
