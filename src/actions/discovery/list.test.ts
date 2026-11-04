// src/actions/discovery/list.test.ts
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
    .mockResolvedValue({ amount: 3.67, rate: 3.67, stale: true }),
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
  getMatchingSubscriptionIds,
  getSubscriptionFilterOptions,
  getSubscriptionListPage,
} from "./list";

const baseRow = {
  id: "s1",
  appId: "a1",
  status: "ACTIVE",
  billingCycle: "MONTHLY",
  billingType: "FLAT_RATE",
  amount: 10,
  perSeatPrice: null,
  currency: "USD",
  totalLicenses: null,
  usedLicenses: null,
  startDate: new Date("2026-01-01"),
  endDate: null,
  renewalDate: null,
  autoRenewal: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  teamId: null,
  isPersonal: false,
  isTrial: false,
  trialEndsAt: null,
  cancellationDeadline: null,
  app: {
    name: "Slack",
    customLogoUrl: null,
    catalog: { logoUrl: "https://l" },
  },
  team: null,
  subscriptionTeams: [{ team: { id: "t1", name: "Ops" } }],
  assignedUsers: [],
  category: {
    id: "c1",
    name: "Chat",
    color: "#0f0",
    parent: { name: "Productivity" },
  },
  tags: [],
  owner: null,
  paymentMethod: null,
  costCenter: null,
};

describe("getSubscriptionListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermission.mockResolvedValue(permissionResult(ALL_READ));
    getSettings.mockResolvedValue({
      "discovery.listPageSizeOptions": [10, 20],
      "discovery.exportMaxRows": 1000,
    });
    prisma.user.findUnique.mockResolvedValue({ teamId: "t1" });
  });

  it("returns mapped rows, totals in base currency and pagination", async () => {
    prisma.subscription.findMany
      .mockResolvedValueOnce([baseRow])
      .mockResolvedValueOnce([
        { amount: 10, currency: "USD", billingCycle: "MONTHLY" },
        { amount: 120, currency: "AED", billingCycle: "YEARLY" },
      ]);
    prisma.subscription.count.mockResolvedValue(2);

    const result = await getSubscriptionListPage({
      filter: { statuses: ["ACTIVE"] },
      sort: { sortBy: "amount", sortOrder: "desc" },
      page: 2,
      limit: 1,
    });
    expect(result.success).toBe(true);
    const data = result.data!;
    expect(data.items[0]).toMatchObject({
      appName: "Slack",
      appLogoUrl: "https://l",
      category: { id: "c1", parentName: "Productivity" },
      teams: [{ id: "t1", name: "Ops" }],
      monthlyAmountBase: 36.7,
    });
    expect(data.monthlyTotalBase).toBeCloseTo(46.7);
    expect(data).toMatchObject({
      total: 2,
      page: 2,
      limit: 1,
      totalPages: 2,
      baseCurrency: "AED",
      hasStaleRates: true,
      pageSizeOptions: [10, 20],
    });
    expect(prisma.subscription.findMany.mock.calls[0][0]).toMatchObject({
      skip: 1,
      take: 1,
      orderBy: [{ amount: "desc" }],
    });
  });

  it("validates the query and surfaces forbidden errors", async () => {
    expect(
      (
        await getSubscriptionListPage({
          filter: {},
          sort: { sortBy: "amount", sortOrder: "desc" },
          page: 0,
          limit: 10,
        })
      ).success
    ).toBe(false);
    requirePermission.mockRejectedValue(
      new FakeForbidden("subscriptions:read")
    );
    expect(
      (
        await getSubscriptionListPage({
          filter: {},
          sort: { sortBy: "amount", sortOrder: "desc" },
          page: 1,
          limit: 10,
        })
      ).success
    ).toBe(false);
  });
});

describe("getMatchingSubscriptionIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermission.mockResolvedValue(permissionResult(ALL_READ));
    getSettings.mockResolvedValue({ "discovery.exportMaxRows": 2 });
    prisma.user.findUnique.mockResolvedValue({ teamId: null });
  });

  it("returns ids up to the cap and reports capping", async () => {
    prisma.subscription.findMany.mockResolvedValue([
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ]);
    const result = await getMatchingSubscriptionIds({ search: "x" });
    expect(result.data).toEqual({ ids: ["a", "b"], capped: true });
    expect(prisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 })
    );
  });
});

describe("getSubscriptionFilterOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermission.mockResolvedValue(permissionResult(ALL_READ));
    prisma.category.findMany.mockResolvedValue([
      { id: "p1", name: "Productivity", color: null, parentId: null },
      { id: "c1", name: "Chat", color: null, parentId: "p1" },
    ]);
    prisma.tag.findMany.mockResolvedValue([
      { id: "t1", name: "core", color: null },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: "u1", name: null, email: "s@x.com" },
    ]);
    prisma.team.findMany.mockResolvedValue([]);
    prisma.costCenter.findMany.mockResolvedValue([
      { id: "cc", name: "Engineering", code: "ENG" },
    ]);
    prisma.paymentMethodOption.findMany.mockResolvedValue([]);
  });

  it("builds a two-level category tree and labelled masters", async () => {
    const result = await getSubscriptionFilterOptions();
    expect(result.data!.categories).toEqual([
      {
        id: "p1",
        name: "Productivity",
        color: null,
        parentId: null,
        children: [{ id: "c1", name: "Chat", color: null, parentId: "p1" }],
      },
    ]);
    expect(result.data!.owners).toEqual([{ id: "u1", name: "s@x.com" }]);
    expect(result.data!.costCenters).toEqual([
      { id: "cc", name: "ENG · Engineering" },
    ]);
  });
});
