// src/lib/services/platform-analytics/aggregate.test.ts
import { describe, expect, it } from "vitest";

import {
  buildGrowth,
  buildOrganizationRows,
  buildSignIns,
  buildSpendTrend,
  NONE_KEY,
  OTHER_KEY,
  rankApps,
  sliceSpend,
  spendByOrganization,
  sumPlatformKpis,
  type Converted,
} from "./aggregate";
import type { OrganizationActivityRow, SpendRow } from "./queries";

const round = (v: number) => Math.round(v * 100) / 100;

function row(over: Partial<SpendRow>): SpendRow {
  return {
    organizationId: "o1",
    currency: "AED",
    billingCycle: "MONTHLY",
    categoryKey: null,
    categoryLabel: null,
    teamKey: null,
    teamLabel: null,
    costCentreKey: null,
    costCentreLabel: null,
    appKey: "slack",
    appName: "Slack",
    logoUrl: null,
    count: 1,
    amount: 0,
    ...over,
  };
}

const c = (r: SpendRow, monthly: number): Converted<SpendRow> => ({
  row: r,
  monthly,
});

const CATEGORY = {
  key: (r: SpendRow) => r.categoryKey,
  label: (r: SpendRow) => r.categoryLabel,
  noneLabel: "Uncategorised",
};

describe("sliceSpend", () => {
  const rows = [
    c(row({ categoryKey: "c1", categoryLabel: "Design" }), 100),
    c(
      row({ organizationId: "o2", categoryKey: "c9", categoryLabel: "design" }),
      50
    ),
    c(row({ categoryKey: "c2", categoryLabel: "Chat" }), 300),
    c(row({ categoryKey: "c3", categoryLabel: "Docs" }), 10),
    c(row({}), 5),
  ];

  it("merges categories with the same name across organisations", () => {
    const slices = sliceSpend(
      rows,
      { ...CATEGORY, mergeByLabel: true },
      10,
      round
    );
    expect(slices.map((s) => [s.label, s.monthly, s.count])).toEqual([
      ["Chat", 300, 1],
      ["Design", 150, 2],
      ["Docs", 10, 1],
      ["Uncategorised", 5, 1],
    ]);
    expect(slices.at(-1)?.key).toBe(NONE_KEY);
  });

  it("folds everything past the limit into Other", () => {
    const slices = sliceSpend(rows, CATEGORY, 2, round);
    expect(slices.map((s) => s.key)).toEqual(["c2", "c1", OTHER_KEY]);
    expect(slices[2]).toMatchObject({ label: "Other (3)", monthly: 65 });
  });
});

describe("rankApps", () => {
  const rows = [
    c(row({ appKey: "cat-slack", appName: "Slack" }), 400),
    c(
      row({ organizationId: "o2", appKey: "cat-slack", appName: "Slack" }),
      100
    ),
    c(row({ appKey: "figma", appName: "Figma", logoUrl: "/f.png" }), 700),
  ];

  it("ranks by spend and counts organisations per app", () => {
    const apps = rankApps(rows, 5, "monthly", round);
    expect(apps.map((a) => [a.name, a.monthly, a.organizations])).toEqual([
      ["Figma", 700, 1],
      ["Slack", 500, 2],
    ]);
    expect(apps[0].logoUrl).toBe("/f.png");
  });

  it("ranks by adoption (organisations) when asked", () => {
    const apps = rankApps(rows, 1, "organizations", round);
    expect(apps.map((a) => a.name)).toEqual(["Slack"]);
  });
});

describe("series builders", () => {
  const months = ["2026-09", "2026-10", "2026-11"];

  it("zero-fills the spend trend and sums organisations", () => {
    const trend = buildSpendTrend(
      months,
      [
        { row: { month: "2026-10" }, monthly: 10.004 },
        { row: { month: "2026-10" }, monthly: 5 },
        { row: { month: "2026-11" }, monthly: 20 },
      ],
      round
    );
    expect(trend).toEqual([
      { month: "2026-09", monthly: 0 },
      { month: "2026-10", monthly: 15 },
      { month: "2026-11", monthly: 20 },
    ]);
  });

  it("zero-fills growth and sign-ins, ignoring months outside the period", () => {
    const growth = buildGrowth(months, [
      { series: "users", month: "2026-11", count: 4 },
      { series: "organizations", month: "2026-01", count: 9 },
    ]);
    expect(growth.at(-1)).toEqual({
      month: "2026-11",
      organizations: 0,
      users: 4,
      subscriptions: 0,
    });
    expect(growth.reduce((s, g) => s + g.organizations, 0)).toBe(0);
    expect(
      buildSignIns(months, [{ month: "2026-10", signIns: 7, users: 3 }])[1]
    ).toEqual({ month: "2026-10", signIns: 7, users: 3 });
  });
});

describe("organisation rows and platform KPIs", () => {
  const activity: OrganizationActivityRow[] = [
    {
      id: "o1",
      name: "Acme",
      createdAt: new Date("2026-01-01Z"),
      deactivatedAt: null,
      users: 10,
      activeUsers: 8,
      signedInUsers: 5,
      lastLoginAt: new Date("2026-11-08T10:00:00Z"),
      activeSubscriptions: 3,
      renewalsDue: 1,
      pendingApprovals: 2,
    },
    {
      id: "o2",
      name: "Beta",
      createdAt: new Date("2026-02-01Z"),
      deactivatedAt: new Date("2026-10-01Z"),
      users: 2,
      activeUsers: 0,
      signedInUsers: 0,
      lastLoginAt: null,
      activeSubscriptions: 0,
      renewalsDue: 0,
      pendingApprovals: 0,
    },
  ];

  it("joins spend per organisation and sums the KPI row", () => {
    const spend = spendByOrganization([
      c(row({ organizationId: "o1" }), 100.5),
      c(row({ organizationId: "o1" }), 20),
    ]);
    const rows = buildOrganizationRows(activity, spend, round);
    expect(rows[0]).toMatchObject({
      status: "active",
      monthlySpend: 120.5,
      lastActivityAt: "2026-11-08T10:00:00.000Z",
    });
    expect(rows[1]).toMatchObject({ status: "suspended", monthlySpend: 0 });

    const kpis = sumPlatformKpis(rows, 120.5, round, 12);
    expect(kpis).toEqual({
      organizations: 2,
      activeOrganizations: 1,
      suspendedOrganizations: 1,
      users: 12,
      activeUsers: 8,
      signedInUsers: 5,
      activeSubscriptions: 3,
      monthlySpend: 120.5,
      annualRunRate: 1446,
      renewalsDue: 1,
      pendingApprovals: 2,
    });
  });
});
