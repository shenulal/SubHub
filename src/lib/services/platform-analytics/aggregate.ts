// src/lib/services/platform-analytics/aggregate.ts
/**
 * Pure roll-ups for Control Panel analytics: grouped SQL rows (already
 * converted to monthly amounts in the target currency) → chart series, ranked
 * slices and the organisation comparison table. No I/O.
 */
import type {
  GrowthPoint,
  OrganizationComparisonRow,
  PlatformKpis,
  SignInPoint,
  SpendPoint,
  SpendSlice,
  TopApp,
} from "@/types/platform-analytics";

import type {
  GrowthRow,
  OrganizationActivityRow,
  SignInRow,
  SpendRow,
} from "./queries";

export const OTHER_KEY = "__other";
export const NONE_KEY = "__none";

export interface Converted<T> {
  row: T;
  monthly: number;
}

type Round = (value: number) => number;

interface SliceSpec {
  key: (row: SpendRow) => string | null;
  label: (row: SpendRow) => string | null;
  noneLabel: string;
  /** Merge slices with the same label (case-insensitive) across organisations. */
  mergeByLabel?: boolean;
}

/** Monthly spend per organisation id. */
export function spendByOrganization(
  converted: Converted<SpendRow>[]
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const { row, monthly } of converted) {
    totals.set(
      row.organizationId,
      (totals.get(row.organizationId) ?? 0) + monthly
    );
  }
  return totals;
}

/** Ranked spend slices; everything past `limit` is folded into "Other". */
export function sliceSpend(
  converted: Converted<SpendRow>[],
  spec: SliceSpec,
  limit: number,
  round: Round
): SpendSlice[] {
  const buckets = new Map<string, SpendSlice>();
  for (const { row, monthly } of converted) {
    const label = spec.label(row);
    const rawKey = label ? spec.key(row) : null;
    const key = !rawKey
      ? NONE_KEY
      : spec.mergeByLabel
        ? label!.trim().toLowerCase()
        : rawKey;
    const current = buckets.get(key) ?? {
      key,
      label: label ?? spec.noneLabel,
      monthly: 0,
      count: 0,
    };
    buckets.set(key, {
      ...current,
      monthly: current.monthly + monthly,
      count: current.count + row.count,
    });
  }
  const ranked = [...buckets.values()].sort((a, b) => b.monthly - a.monthly);
  const head = ranked.slice(0, limit);
  const tail = ranked.slice(limit);
  const other: SpendSlice[] = tail.length
    ? [
        {
          key: OTHER_KEY,
          label: `Other (${tail.length})`,
          monthly: tail.reduce((s, x) => s + x.monthly, 0),
          count: tail.reduce((s, x) => s + x.count, 0),
        },
      ]
    : [];
  return [...head, ...other].map((s) => ({ ...s, monthly: round(s.monthly) }));
}

/** Apps across organisations (matched by catalog entry or name). */
export function rankApps(
  converted: Converted<SpendRow>[],
  limit: number,
  sortBy: "monthly" | "organizations",
  round: Round
): TopApp[] {
  const apps = new Map<string, TopApp & { orgIds: Set<string> }>();
  for (const { row, monthly } of converted) {
    const current = apps.get(row.appKey) ?? {
      key: row.appKey,
      name: row.appName,
      logoUrl: row.logoUrl,
      organizations: 0,
      subscriptions: 0,
      monthly: 0,
      orgIds: new Set<string>(),
    };
    current.orgIds.add(row.organizationId);
    apps.set(row.appKey, {
      ...current,
      logoUrl: current.logoUrl ?? row.logoUrl,
      organizations: current.orgIds.size,
      subscriptions: current.subscriptions + row.count,
      monthly: current.monthly + monthly,
    });
  }
  const secondary = sortBy === "monthly" ? "organizations" : "monthly";
  return [...apps.values()]
    .sort(
      (a, b) =>
        b[sortBy] - a[sortBy] ||
        b[secondary] - a[secondary] ||
        a.name.localeCompare(b.name)
    )
    .slice(0, limit)
    .map(({ orgIds: _orgIds, ...app }) => ({
      ...app,
      monthly: round(app.monthly),
    }));
}

/** One point per month (zero-filled) from converted trend rows. */
export function buildSpendTrend(
  months: string[],
  converted: Converted<{ month: string }>[],
  round: Round
): SpendPoint[] {
  const totals = new Map<string, number>();
  for (const { row, monthly } of converted) {
    totals.set(row.month, (totals.get(row.month) ?? 0) + monthly);
  }
  return months.map((month) => ({
    month,
    monthly: round(totals.get(month) ?? 0),
  }));
}

export function buildGrowth(
  months: string[],
  rows: GrowthRow[]
): GrowthPoint[] {
  const byMonth = new Map<string, GrowthPoint>(
    months.map((month) => [
      month,
      { month, organizations: 0, users: 0, subscriptions: 0 },
    ])
  );
  for (const row of rows) {
    const point = byMonth.get(row.month);
    if (point) byMonth.set(row.month, { ...point, [row.series]: row.count });
  }
  return [...byMonth.values()];
}

export function buildSignIns(
  months: string[],
  rows: SignInRow[]
): SignInPoint[] {
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return months.map((month) => ({
    month,
    signIns: byMonth.get(month)?.signIns ?? 0,
    users: byMonth.get(month)?.users ?? 0,
  }));
}

export function buildOrganizationRows(
  activity: OrganizationActivityRow[],
  spend: Map<string, number>,
  round: Round
): OrganizationComparisonRow[] {
  return activity.map((org) => ({
    id: org.id,
    name: org.name,
    status: org.deactivatedAt ? "suspended" : "active",
    users: org.users,
    activeUsers: org.activeUsers,
    signedInUsers: org.signedInUsers,
    activeSubscriptions: org.activeSubscriptions,
    monthlySpend: round(spend.get(org.id) ?? 0),
    pendingApprovals: org.pendingApprovals,
    renewalsDue: org.renewalsDue,
    lastActivityAt: org.lastLoginAt ? org.lastLoginAt.toISOString() : null,
  }));
}

export function sumPlatformKpis(
  rows: OrganizationComparisonRow[],
  monthlySpend: number,
  round: Round,
  monthsPerYear: number
): PlatformKpis {
  const sum = (pick: (r: OrganizationComparisonRow) => number) =>
    rows.reduce((total, r) => total + pick(r), 0);
  const suspended = rows.filter((r) => r.status === "suspended").length;
  return {
    organizations: rows.length,
    activeOrganizations: rows.length - suspended,
    suspendedOrganizations: suspended,
    users: sum((r) => r.users),
    activeUsers: sum((r) => r.activeUsers),
    signedInUsers: sum((r) => r.signedInUsers),
    activeSubscriptions: sum((r) => r.activeSubscriptions),
    monthlySpend: round(monthlySpend),
    annualRunRate: round(monthlySpend * monthsPerYear),
    renewalsDue: sum((r) => r.renewalsDue),
    pendingApprovals: sum((r) => r.pendingApprovals),
  };
}
