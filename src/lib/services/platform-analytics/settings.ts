// src/lib/services/platform-analytics/settings.ts
/** Control Panel analytics tunables (system scope, edited in Platform settings). */
import { getSystemSetting } from "@/lib/settings/service";

export interface AnalyticsSettings {
  periods: string[];
  defaultPeriod: string;
  renewalWindowDays: number;
  topListSize: number;
  /** Platform reporting currency (`system.reportingCurrency`). */
  platformCurrency: string;
}

export async function loadAnalyticsSettings(): Promise<AnalyticsSettings> {
  const [periods, defaultPeriod, renewalWindowDays, topListSize, currency] =
    await Promise.all([
      getSystemSetting("system.analyticsPeriods"),
      getSystemSetting("system.analyticsDefaultPeriod"),
      getSystemSetting("system.analyticsRenewalWindowDays"),
      getSystemSetting("system.analyticsTopListSize"),
      getSystemSetting("system.reportingCurrency"),
    ]);
  return {
    periods,
    defaultPeriod,
    renewalWindowDays,
    topListSize,
    platformCurrency: currency,
  };
}
