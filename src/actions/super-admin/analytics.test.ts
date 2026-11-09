// src/actions/super-admin/analytics.test.ts
// Control Panel analytics: guard, scoping, and FX-correct totals. The grouped
// SQL is stubbed at the queries module; conversion runs through the real
// BaseConverter / FX helpers with a fixed USD→AED rate.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/require-auth", () => ({ getCachedSession: vi.fn() }));
vi.mock("@/lib/platform/platform-user", () => ({ loadPlatformUser: vi.fn() }));
vi.mock("@/lib/logging", () => ({
  withLogging: (_n: string, fn: unknown) => fn,
}));
vi.mock("@/lib/deployment/mode", () => ({ isSaas: vi.fn(() => true) }));
vi.mock("@/lib/db", () => ({
  prisma: { organization: { findFirst: vi.fn() } },
}));
const SYSTEM: Record<string, unknown> = {
  "system.analyticsPeriods": ["30d", "90d", "12m"],
  "system.analyticsDefaultPeriod": "90d",
  "system.analyticsRenewalWindowDays": 30,
  "system.analyticsTopListSize": 8,
  "system.reportingCurrency": "AED",
};
vi.mock("@/lib/settings/service", () => ({
  getSystemSetting: vi.fn(async (key: string) => SYSTEM[key]),
  getSetting: vi.fn(async () => "AED"),
  getSettings: vi.fn(),
}));
vi.mock("@/lib/fx/rates", () => ({
  PIVOT_CURRENCY: "USD",
  getRate: vi.fn(async (from: string, to: string) => ({
    rate:
      from === to ? 1 : from === "USD" && to === "AED" ? 3.6725 : 1 / 3.6725,
    asOf: new Date(),
    stale: false,
    source: "test",
  })),
}));
vi.mock("@/lib/services/platform-analytics/queries", () => ({
  queryOrganizationActivity: vi.fn(),
  querySpendRows: vi.fn(),
  querySpendTrend: vi.fn(),
  queryGrowth: vi.fn(),
  queryCycleMonths: vi.fn(),
  queryOrganizationDetail: vi.fn(),
  querySubscriptionsByStatus: vi.fn(),
  queryUsersByRole: vi.fn(),
  querySignIns: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { isSaas } from "@/lib/deployment/mode";
import * as q from "@/lib/services/platform-analytics/queries";
import { getSetting } from "@/lib/settings/service";
import {
  SUPER_ADMIN,
  TENANT_ADMIN,
  signInAs,
} from "@/test/platform-session-mock";

import { getOrganizationAnalytics, getPlatformAnalytics } from "./analytics";

const ORG = {
  id: "org-qa",
  name: "SubHub QA",
  createdAt: new Date("2026-11-05T10:00:00Z"),
  deactivatedAt: null,
  users: 4,
  activeUsers: 4,
  signedInUsers: 4,
  lastLoginAt: new Date("2026-11-06T11:15:34Z"),
  activeSubscriptions: 3,
  renewalsDue: 2,
  pendingApprovals: 1,
};

const spend = (
  appKey: string,
  currency: string,
  cycle: string,
  amount: number
) => ({
  organizationId: ORG.id,
  currency,
  billingCycle: cycle,
  categoryKey: "cat-1",
  categoryLabel: "Productivity",
  teamKey: "team-1",
  teamLabel: "Engineering",
  costCentreKey: null,
  costCentreLabel: null,
  appKey,
  appName: appKey,
  logoUrl: null,
  count: 1,
  amount,
});

const QA_SPEND = [
  spend("Slack", "USD", "MONTHLY", 420),
  spend("Figma", "AED", "YEARLY", 1500),
  spend("Notion", "USD", "MONTHLY", 96),
];

beforeEach(() => {
  vi.clearAllMocks();
  signInAs(SUPER_ADMIN);
  vi.mocked(isSaas).mockReturnValue(true);
  vi.mocked(q.queryOrganizationActivity).mockResolvedValue([ORG]);
  vi.mocked(q.querySpendRows).mockResolvedValue(QA_SPEND);
  vi.mocked(q.querySpendTrend).mockResolvedValue(
    QA_SPEND.map((r) => ({ ...r, month: "2026-11" }))
  );
  vi.mocked(q.queryGrowth).mockResolvedValue([
    { series: "subscriptions", month: "2026-11", count: 3 },
  ]);
  vi.mocked(q.queryCycleMonths).mockResolvedValue([]);
  vi.mocked(q.queryOrganizationDetail).mockResolvedValue({
    apps: 3,
    teams: 1,
    pending: 1,
    submitted: 2,
    approved: 1,
    rejected: 0,
    avgDecisionSeconds: 5400,
  });
  vi.mocked(q.querySubscriptionsByStatus).mockResolvedValue([
    { key: "ACTIVE", label: null, count: 3 },
  ]);
  vi.mocked(q.queryUsersByRole).mockResolvedValue([
    { key: "ADMIN", label: null, count: 1 },
    { key: "role-fin", label: "Finance lead", count: 3 },
  ]);
  vi.mocked(q.querySignIns).mockResolvedValue([
    { month: "2026-11", signIns: 12, users: 4 },
  ]);
  vi.mocked(prisma.organization.findFirst).mockResolvedValue({
    id: ORG.id,
    name: ORG.name,
  } as never);
});

const queryMocks = () => Object.values(q).filter((f) => vi.isMockFunction(f));

describe("Control Panel analytics guard", () => {
  it.each([
    ["a tenant ADMIN", TENANT_ADMIN],
    ["a signed-out visitor", null],
  ])("refuses %s without touching the database", async (_label, user) => {
    signInAs(user);
    const platform = await getPlatformAnalytics();
    const org = await getOrganizationAnalytics({ organizationId: ORG.id });
    expect(platform.success).toBe(false);
    expect(org.success).toBe(false);
    for (const fn of queryMocks()) expect(fn).not.toHaveBeenCalled();
    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
  });
});

describe("getPlatformAnalytics", () => {
  it("converts mixed USD/AED spend into the platform base currency", async () => {
    const result = await getPlatformAnalytics({ period: "12m" });
    expect(result.success).toBe(true);
    const data = result.data!;
    expect(data.currency).toBe("AED");
    // 420 × 3.6725 + 1500 / 12 + 96 × 3.6725
    expect(data.kpis.monthlySpend).toBe(2020.01);
    expect(data.kpis.annualRunRate).toBe(24240.12);
    expect(data.organizations[0]).toMatchObject({
      id: ORG.id,
      monthlySpend: 2020.01,
      status: "active",
    });
    expect(data.spendTrend.at(-1)?.monthly).toBe(2020.01);
    expect(data.spendByCategory[0]).toMatchObject({
      label: "Productivity",
      monthly: 2020.01,
      count: 3,
    });
    expect(data.topAppsBySpend.map((a) => a.name)).toEqual([
      "Slack",
      "Notion",
      "Figma",
    ]);
    expect(data.period.token).toBe("12m");
    expect(data.period.months).toHaveLength(12);
  });

  it("queries platform-wide (no organisation filter) and uses the default period", async () => {
    const result = await getPlatformAnalytics({ period: "bogus" });
    expect(result.data?.period.token).toBe("90d");
    expect(q.querySpendRows).toHaveBeenCalledWith({});
    expect(q.queryCycleMonths).toHaveBeenCalledWith({});
    const [activityArgs] = vi.mocked(q.queryOrganizationActivity).mock.calls[0];
    expect(activityArgs.organizationId).toBeUndefined();
    expect(
      activityArgs.renewalUntil.getTime() - activityArgs.now.getTime()
    ).toBe(30 * 86_400_000);
  });

  it("returns an error state when a query fails", async () => {
    vi.mocked(q.querySpendRows).mockRejectedValueOnce(new Error("pool"));
    const result = await getPlatformAnalytics();
    expect(result).toMatchObject({
      success: false,
      error: "Could not load analytics.",
    });
  });
});

describe("getOrganizationAnalytics", () => {
  it("scopes every query to the organisation and uses its base currency", async () => {
    vi.mocked(getSetting).mockResolvedValueOnce("USD");
    const result = await getOrganizationAnalytics({
      organizationId: ORG.id,
      period: "30d",
    });
    expect(result.success).toBe(true);
    const data = result.data!;
    expect(getSetting).toHaveBeenCalledWith(ORG.id, "finance.baseCurrency");
    expect(q.querySpendRows).toHaveBeenCalledWith({ organizationId: ORG.id });
    expect(data.currency).toBe("USD");
    // 420 + 1500 / 3.6725 / 12 + 96
    expect(data.kpis.monthlySpend).toBe(550.04);
    expect(data.kpis).toMatchObject({ apps: 3, teams: 1, renewalsDue: 2 });
    expect(data.approvals.avgDecisionHours).toBe(1.5);
    expect(data.usersByRole.map((r) => r.label)).toEqual([
      "ADMIN",
      "Finance lead",
    ]);
    expect(data.spendByTeam[0]).toMatchObject({ label: "Engineering" });
    expect(data.spendByCostCentre[0]).toMatchObject({
      label: "No cost centre",
    });
    expect(data.signIns.at(-1)).toEqual({
      month: "2026-11",
      signIns: 12,
      users: 4,
    });
  });

  it("requires a selected organisation in SaaS mode", async () => {
    const result = await getOrganizationAnalytics({});
    expect(result).toMatchObject({ success: false, error: "Select a tenant." });
    expect(q.queryOrganizationActivity).not.toHaveBeenCalled();
  });

  it("uses the only organisation in single-tenant mode", async () => {
    vi.mocked(isSaas).mockReturnValue(false);
    const result = await getOrganizationAnalytics();
    expect(result.success).toBe(true);
    expect(result.data?.organization.name).toBe("SubHub QA");
  });

  it("reports deleted or unknown organisations as not found", async () => {
    vi.mocked(prisma.organization.findFirst).mockResolvedValueOnce(null);
    const result = await getOrganizationAnalytics({ organizationId: "gone" });
    expect(result).toMatchObject({
      success: false,
      error: "Tenant information not found.",
    });
    expect(q.querySpendRows).not.toHaveBeenCalled();
  });
});
