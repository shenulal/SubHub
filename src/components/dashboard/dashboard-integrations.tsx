// src/components/dashboard/dashboard-integrations.tsx
"use client";

/**
 * Widgets owned by other feature areas that the dashboard mounts (4.4):
 * pending approvals (Approvals agent), onboarding checklist (Notifications
 * agent) and price-change alerts (Lifecycle agent). Team/approval widgets are
 * hidden in personal mode.
 */
import { PendingApprovalsCard } from "@/components/approvals/pending-approvals-card";
import { OnboardingChecklist } from "@/components/notifications/onboarding-checklist";
import { PriceChangeAlerts } from "@/components/subscriptions/price-change-alerts";

interface DashboardIntegrationsProps {
  isPersonal: boolean;
}

export function DashboardIntegrations({
  isPersonal,
}: DashboardIntegrationsProps) {
  return (
    <div
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      data-testid="dashboard-integrations"
    >
      {!isPersonal && <PendingApprovalsCard />}
      <OnboardingChecklist />
      <PriceChangeAlerts />
    </div>
  );
}
