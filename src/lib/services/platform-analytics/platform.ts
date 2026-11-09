// src/lib/services/platform-analytics/platform.ts
/** Platform-wide analytics across every (non-deleted) organisation. */
import { MONTHS_PER_YEAR } from "@/lib/fx/convert";
import type {
  AnalyticsPeriodInfo,
  PlatformAnalytics,
} from "@/types/platform-analytics";

import {
  buildGrowth,
  buildOrganizationRows,
  buildSpendTrend,
  rankApps,
  sliceSpend,
  spendByOrganization,
  sumPlatformKpis,
} from "./aggregate";
import { SpendConverter } from "./money";
import { resolvePeriod } from "./period";
import {
  queryCycleMonths,
  queryGrowth,
  queryOrganizationActivity,
  querySpendRows,
  querySpendTrend,
} from "./queries";
import type { AnalyticsSettings } from "./settings";

const MS_PER_DAY = 86_400_000;

export const CATEGORY_SLICE = {
  key: (r: { categoryKey: string | null }) => r.categoryKey,
  label: (r: { categoryLabel: string | null }) => r.categoryLabel,
  noneLabel: "Uncategorised",
};

export interface BuildInput {
  settings: AnalyticsSettings;
  requestedPeriod?: string | null;
  now?: Date;
}

export function renewalUntil(now: Date, settings: AnalyticsSettings): Date {
  return new Date(now.getTime() + settings.renewalWindowDays * MS_PER_DAY);
}

/**
 * Queries run one after another (small connection pool); each is a single
 * grouped statement, so the cost does not grow with the number of tenants.
 */
async function loadPlatformData(
  period: AnalyticsPeriodInfo,
  settings: AnalyticsSettings,
  now: Date
) {
  const since = new Date(period.since);
  const activity = await queryOrganizationActivity({
    since,
    now,
    renewalUntil: renewalUntil(now, settings),
  });
  const spendRows = await querySpendRows({});
  const trendRows = await querySpendTrend({ since, now });
  const growthRows = await queryGrowth({ since });
  const converter = new SpendConverter(
    settings.platformCurrency,
    await queryCycleMonths({})
  );
  const spend = await converter.monthlyAll(spendRows);
  const trend = await converter.monthlyAll(trendRows);
  return { activity, spend, trend, growthRows, converter };
}

export async function buildPlatformAnalytics({
  settings,
  requestedPeriod,
  now = new Date(),
}: BuildInput): Promise<PlatformAnalytics> {
  const period = resolvePeriod({
    requested: requestedPeriod,
    allowed: settings.periods,
    fallback: settings.defaultPeriod,
    now,
  });
  const { activity, spend, trend, growthRows, converter } =
    await loadPlatformData(period, settings, now);
  const round = (v: number) => converter.round(v);
  const byOrg = spendByOrganization(spend);
  const organizations = buildOrganizationRows(activity, byOrg, round);
  const total = [...byOrg.values()].reduce((s, v) => s + v, 0);
  const limit = settings.topListSize;
  return {
    currency: converter.currency,
    hasStaleRates: converter.hasStaleRates,
    period,
    renewalWindowDays: settings.renewalWindowDays,
    generatedAt: now.toISOString(),
    kpis: sumPlatformKpis(organizations, total, round, MONTHS_PER_YEAR),
    growth: buildGrowth(period.months, growthRows),
    spendTrend: buildSpendTrend(period.months, trend, round),
    spendByCategory: sliceSpend(
      spend,
      { ...CATEGORY_SLICE, mergeByLabel: true },
      limit,
      round
    ),
    topAppsBySpend: rankApps(spend, limit, "monthly", round),
    topAppsByAdoption: rankApps(spend, limit, "organizations", round),
    organizations,
  };
}
