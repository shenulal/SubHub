// src/lib/services/platform-analytics/organization.ts
/** Analytics for one organisation, in that organisation's base currency. */
import { MONTHS_PER_YEAR } from "@/lib/fx/convert";
import { getSetting } from "@/lib/settings/service";
import type {
  AnalyticsPeriodInfo,
  ApprovalsSummary,
  CountSlice,
  OrganizationAnalytics,
} from "@/types/platform-analytics";

import {
  buildGrowth,
  buildSignIns,
  buildSpendTrend,
  rankApps,
  sliceSpend,
  type Converted,
} from "./aggregate";
import { SpendConverter } from "./money";
import { resolvePeriod } from "./period";
import { CATEGORY_SLICE, renewalUntil, type BuildInput } from "./platform";
import {
  queryCycleMonths,
  queryGrowth,
  queryOrganizationActivity,
  queryOrganizationDetail,
  querySignIns,
  querySpendRows,
  querySpendTrend,
  querySubscriptionsByStatus,
  queryUsersByRole,
  type CountRow,
  type GrowthRow,
  type OrganizationActivityRow,
  type OrganizationDetailRow,
  type SignInRow,
  type SpendRow,
} from "./queries";

const SECONDS_PER_HOUR = 3600;
const HOUR_DECIMALS = 1;

/** Custom role / label when present, else the code value (the UI maps it). */
const toSlices = (rows: CountRow[]) =>
  rows.map<CountSlice>((r) => ({
    key: r.key,
    label: r.label ?? r.key,
    count: r.count,
  }));

export function toApprovals(detail: OrganizationDetailRow): ApprovalsSummary {
  const seconds = detail.avgDecisionSeconds;
  const factor = 10 ** HOUR_DECIMALS;
  return {
    pending: detail.pending,
    submitted: detail.submitted,
    approved: detail.approved,
    rejected: detail.rejected,
    avgDecisionHours:
      seconds === null || seconds === undefined
        ? null
        : Math.round((Number(seconds) / SECONDS_PER_HOUR) * factor) / factor,
  };
}

interface OrganizationData {
  org: OrganizationActivityRow;
  detail: OrganizationDetailRow;
  spend: Converted<SpendRow>[];
  trend: Converted<{ month: string }>[];
  growth: GrowthRow[];
  statuses: CountRow[];
  roles: CountRow[];
  signIns: SignInRow[];
  converter: SpendConverter;
}

/** Sequential grouped queries (small pool); null when the org is gone. */
async function loadOrganizationData(
  organizationId: string,
  period: AnalyticsPeriodInfo,
  input: BuildInput & { now: Date }
): Promise<OrganizationData | null> {
  const { now, settings } = input;
  const since = new Date(period.since);
  const scope = { organizationId };
  const [org] = await queryOrganizationActivity({
    ...scope,
    since,
    now,
    renewalUntil: renewalUntil(now, settings),
  });
  if (!org) return null;
  const detail = await queryOrganizationDetail(organizationId, since);
  const spendRows = await querySpendRows(scope);
  const trendRows = await querySpendTrend({ ...scope, since, now });
  const growth = await queryGrowth({ ...scope, since });
  const statuses = await querySubscriptionsByStatus(organizationId);
  const roles = await queryUsersByRole(organizationId);
  const signIns = await querySignIns(organizationId, since);
  const converter = new SpendConverter(
    await getSetting(organizationId, "finance.baseCurrency"),
    await queryCycleMonths(scope)
  );
  const spend = await converter.monthlyAll(spendRows);
  const trend = await converter.monthlyAll(trendRows);
  return {
    org,
    detail,
    spend,
    trend,
    growth,
    statuses,
    roles,
    signIns,
    converter,
  };
}

function organizationKpis(data: OrganizationData) {
  const { org, detail, spend, converter } = data;
  const monthly = spend.reduce((s, x) => s + x.monthly, 0);
  return {
    users: org.users,
    activeUsers: org.activeUsers,
    signedInUsers: org.signedInUsers,
    activeSubscriptions: org.activeSubscriptions,
    monthlySpend: converter.round(monthly),
    annualRunRate: converter.round(monthly * MONTHS_PER_YEAR),
    renewalsDue: org.renewalsDue,
    pendingApprovals: org.pendingApprovals,
    apps: detail.apps,
    teams: detail.teams,
  };
}

function spendBreakdowns(data: OrganizationData, limit: number) {
  const { spend, converter } = data;
  const round = (v: number) => converter.round(v);
  return {
    spendByCategory: sliceSpend(spend, CATEGORY_SLICE, limit, round),
    spendByTeam: sliceSpend(
      spend,
      {
        key: (r) => r.teamKey,
        label: (r) => r.teamLabel,
        noneLabel: "No team",
      },
      limit,
      round
    ),
    spendByCostCentre: sliceSpend(
      spend,
      {
        key: (r) => r.costCentreKey,
        label: (r) => r.costCentreLabel,
        noneLabel: "No cost centre",
      },
      limit,
      round
    ),
    topApps: rankApps(spend, limit, "monthly", round),
  };
}

export interface OrganizationBuildInput extends BuildInput {
  organizationId: string;
}

/** Returns null when the organisation does not exist or is deleted. */
export async function buildOrganizationAnalytics(
  input: OrganizationBuildInput
): Promise<OrganizationAnalytics | null> {
  const now = input.now ?? new Date();
  const { settings } = input;
  const period = resolvePeriod({
    requested: input.requestedPeriod,
    allowed: settings.periods,
    fallback: settings.defaultPeriod,
    now,
  });
  const data = await loadOrganizationData(input.organizationId, period, {
    ...input,
    now,
  });
  if (!data) return null;
  const { org, converter } = data;
  return {
    currency: converter.currency,
    hasStaleRates: converter.hasStaleRates,
    period,
    renewalWindowDays: settings.renewalWindowDays,
    generatedAt: now.toISOString(),
    organization: {
      id: org.id,
      name: org.name,
      status: org.deactivatedAt ? "suspended" : "active",
      createdAt: org.createdAt.toISOString(),
      lastActivityAt: org.lastLoginAt ? org.lastLoginAt.toISOString() : null,
    },
    kpis: organizationKpis(data),
    growth: buildGrowth(period.months, data.growth),
    spendTrend: buildSpendTrend(
      period.months,
      data.trend,
      converter.round.bind(converter)
    ),
    ...spendBreakdowns(data, settings.topListSize),
    subscriptionsByStatus: toSlices(data.statuses),
    usersByRole: toSlices(data.roles),
    approvals: toApprovals(data.detail),
    signIns: buildSignIns(period.months, data.signIns),
  };
}
