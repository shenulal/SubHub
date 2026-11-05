// src/actions/discovery/dashboard-overview.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ALL_READ, FakeForbidden, permissionResult } from "./test-helpers";

const { prisma, requirePermission, getSettings } = vi.hoisted(() => {
  const prisma = {
    subscription: { findMany: vi.fn(), count: vi.fn() },
    savedView: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    approvalRequest: { findMany: vi.fn() },
    saaSCatalog: { findMany: vi.fn() },
    category: { findMany: vi.fn() },
    tag: { findMany: vi.fn() },
    team: { findMany: vi.fn() },
    costCenter: { findMany: vi.fn() },
    paymentMethodOption: { findMany: vi.fn() },
    billingCycleConfig: { findMany: vi.fn() },
  };
  const requirePermission = vi.fn();
  const getSettings = vi.fn();
  return { prisma, requirePermission, getSettings };
});

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/rbac/service", () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
  isForbiddenError: (e: unknown) => e instanceof FakeForbidden,
}));
vi.mock("@/lib/settings/service", () => ({
  getSettings: (...args: unknown[]) => getSettings(...args),
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/fx", () => ({
  convertAmount: vi
    .fn()
    .mockResolvedValue({ amount: 2, rate: 2, stale: false }),
  getBaseCurrency: vi.fn().mockResolvedValue("AED"),
  getBillingCycleMonths: vi
    .fn()
    .mockResolvedValue({ MONTHLY: 1, QUARTERLY: 3, YEARLY: 12, ONE_TIME: 0 }),
  toMonthlyAmount: (amount: number, _cycle: string, months?: number) =>
    months ? amount / months : 0,
}));
vi.mock("./scope", () => ({
  getWorkspaceScope: vi
    .fn()
    .mockResolvedValue({ scope: "workspace", allowPersonal: true }),
}));

import {
  getCategorySpendForDashboard,
  getDashboardOverview,
} from "./dashboard-overview";

const DAY = 86_400_000;

describe("getDashboardOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-04T10:00:00Z"));
    requirePermission.mockResolvedValue(permissionResult(ALL_READ));
    getSettings.mockResolvedValue({
      "discovery.renewingSoonDays": 30,
      "discovery.topSpendCount": 2,
    });
    prisma.user.findUnique.mockResolvedValue({ teamId: null });
    prisma.category.findMany.mockResolvedValue([
      { id: "p1", name: "Productivity", color: null },
    ]);
    prisma.approvalRequest.findMany.mockResolvedValue([
      { monthlyAmount: 50, currency: "USD" },
      { monthlyAmount: 10, currency: "AED" },
    ]);
  });

  function activeRows() {
    const now = Date.now();
    const app = (name: string) => ({
      name,
      customLogoUrl: null,
      catalog: null,
    });
    return [
      {
        id: "a",
        amount: 120,
        currency: "AED",
        billingCycle: "YEARLY",
        renewalDate: new Date(now + 5 * DAY),
        isTrial: false,
        app: app("A"),
        category: { id: "c1", name: "Chat", color: null, parentId: "p1" },
      },
      {
        id: "b",
        amount: 30,
        currency: "USD",
        billingCycle: "MONTHLY",
        renewalDate: new Date(now + 2 * DAY),
        isTrial: true,
        app: app("B"),
        category: null,
      },
      {
        id: "c",
        amount: 10,
        currency: "AED",
        billingCycle: "MONTHLY",
        renewalDate: new Date(now + 40 * DAY),
        isTrial: false,
        app: app("C"),
        category: {
          id: "p1",
          name: "Productivity",
          color: null,
          parentId: null,
        },
      },
      {
        id: "d",
        amount: 5,
        currency: "AED",
        billingCycle: "MONTHLY",
        renewalDate: new Date(now + 10 * DAY),
        isTrial: false,
        app: app("D"),
        category: null,
      },
    ];
  }

  it("aggregates KPIs, renewals and category spend in base currency", async () => {
    prisma.subscription.findMany
      .mockResolvedValueOnce(activeRows())
      .mockResolvedValueOnce(activeRows());
    const result = await getDashboardOverview();
    expect(result.success).toBe(true);
    const { kpis, upcomingRenewals, categorySpend, baseCurrency } =
      result.data!;
    expect(baseCurrency).toBe("AED");
    // 120/12 + 30*2 + 10 + 5 = 85
    expect(kpis.monthlySpendBase).toBe(85);
    expect(kpis.annualRunRateBase).toBe(85 * 12);
    expect(kpis.activeCount).toBe(4);
    expect(kpis.renewingSoonCount).toBe(3);
    expect(kpis.pendingApprovalsCount).toBe(2);
    expect(kpis.pendingApprovalsMonthlyBase).toBe(110);
    // Top N (2) sorted by soonest; USD amount converted.
    expect(upcomingRenewals.map((r) => r.id)).toEqual(["b", "a"]);
    expect(upcomingRenewals[0]).toMatchObject({
      amountBase: 60,
      isTrial: true,
      daysUntilRenewal: 2,
    });
    // Parent roll-up: Productivity = own 10 + child Chat 10 = 20; uncategorised = 65
    expect(categorySpend.map((s) => [s.name, s.monthlyBase, s.count])).toEqual([
      ["__uncategorised", 65, 2],
      ["Productivity", 20, 2],
    ]);
    expect(categorySpend[1].children?.[0]).toMatchObject({
      name: "Chat",
      monthlyBase: 10,
    });
  });

  it("hides approvals in personal mode and scopes rows to the user", async () => {
    prisma.subscription.findMany.mockResolvedValue([]);
    const result = await getDashboardOverview("personal");
    expect(prisma.approvalRequest.findMany).not.toHaveBeenCalled();
    expect(result.data!.kpis.pendingApprovalsCount).toBe(0);
    expect(
      JSON.stringify(prisma.subscription.findMany.mock.calls[0][0].where)
    ).toContain('"isPersonal":true');
  });

  it("requires reports:read", async () => {
    requirePermission.mockRejectedValue(new FakeForbidden("reports:read"));
    expect((await getDashboardOverview()).success).toBe(false);
  });
});

describe("getCategorySpendForDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermission.mockResolvedValue(permissionResult(ALL_READ));
    prisma.user.findUnique.mockResolvedValue({ teamId: null });
    prisma.category.findMany.mockResolvedValue([]);
    prisma.subscription.findMany.mockResolvedValue([]);
  });

  it("passes owner/team filters into the query and validates input", async () => {
    const result = await getCategorySpendForDashboard({
      ownerId: "u9",
      teamId: "t9",
    });
    expect(result.success).toBe(true);
    const where = JSON.stringify(
      prisma.subscription.findMany.mock.calls[0][0].where
    );
    expect(where).toContain('"ownerId":"u9"');
    expect(where).toContain('"teamId":"t9"');
    expect((await getCategorySpendForDashboard({ ownerId: "" })).success).toBe(
      false
    );
  });

  it("accepts several owners and teams (multi-select) and empty lists = all", async () => {
    const result = await getCategorySpendForDashboard({
      ownerIds: ["u1", "u2"],
      teamIds: ["t1", "t2"],
    });
    expect(result.success).toBe(true);
    const where = JSON.stringify(
      prisma.subscription.findMany.mock.calls.at(-1)![0].where
    );
    expect(where).toContain('"ownerId":{"in":["u1","u2"]}');
    expect(where).toContain('"teamId":{"in":["t1","t2"]}');

    await getCategorySpendForDashboard({ ownerIds: [], teamIds: [] });
    const unfiltered = JSON.stringify(
      prisma.subscription.findMany.mock.calls.at(-1)![0].where
    );
    expect(unfiltered).not.toContain("u1");
    expect(unfiltered).not.toContain('"teamId":{"in"');
  });
});
