// src/app/(dashboard)/extensions/onboarding/page.tsx
/**
 * Extension onboarding monitoring page
 * Shows onboarding completion against all active users
 */

import { getOnboardingMonitorData } from "@/actions/extensions/onboarding-monitor";
import { getTranslations } from "next-intl/server";
import { OnboardingMonitorClient } from "./onboarding-monitor-client";

export default async function ExtensionOnboardingPage() {
  const t = await getTranslations();
  const { items, total, completedCount, pendingCount } =
    await getOnboardingMonitorData();

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-foreground text-xl font-medium">
          {t("extensions.onboarding.page.title")}
        </h1>
        <p className="text-muted-foreground mt-1 text-[0.9375rem]">
          {t("extensions.onboarding.page.description")}
        </p>
      </div>

      <OnboardingMonitorClient
        items={items}
        total={total}
        completedCount={completedCount}
        pendingCount={pendingCount}
      />
    </div>
  );
}
