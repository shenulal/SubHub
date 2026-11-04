// src/actions/discovery/export.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ALL_READ, FakeForbidden, permissionResult } from "./test-helpers";

const { prisma, requirePermission, getSetting } = vi.hoisted(() => {
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
  const getSetting = vi.fn();
  return { prisma, requirePermission, getSetting };
});

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/rbac/service", () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
  isForbiddenError: (e: unknown) => e instanceof FakeForbidden,
}));
vi.mock("@/lib/settings/service", () => ({
  getSetting: (...args: unknown[]) => getSetting(...args),
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/fx", () => ({
  convertAmount: vi
    .fn()
    .mockResolvedValue({ amount: 1, rate: 1, stale: false }),
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

import { exportCategorySpendCsv, exportSubscriptionsCsv } from "./export";

const row = {
  id: "s1",
  appId: "a1",
  status: "ACTIVE",
  billingCycle: "YEARLY",
  billingType: "FLAT_RATE",
  amount: 1200,
  perSeatPrice: null,
  currency: "AED",
  totalLicenses: 10,
  usedLicenses: 4,
  startDate: new Date("2026-01-01"),
  endDate: null,
  renewalDate: new Date("2027-01-01"),
  autoRenewal: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  teamId: null,
  isPersonal: false,
  isTrial: false,
  trialEndsAt: null,
  cancellationDeadline: null,
  app: { name: "Slack, Inc", customLogoUrl: null, catalog: null },
  team: null,
  subscriptionTeams: [],
  assignedUsers: [],
  category: {
    id: "c1",
    name: "Chat",
    color: null,
    parent: { name: "Productivity" },
  },
  tags: [{ tag: { id: "t1", name: "core", color: null } }],
  owner: { id: "u1", name: "Sara", email: "s@x.com" },
  paymentMethod: { id: "pm", name: "Corp card" },
  costCenter: { id: "cc", code: "ENG", name: "Engineering" },
};

describe("exportSubscriptionsCsv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermission.mockResolvedValue(permissionResult(ALL_READ));
    getSetting.mockResolvedValue(1000);
    prisma.user.findUnique.mockResolvedValue({ teamId: null });
    prisma.auditLog.create.mockResolvedValue({});
  });

  it("produces a BOM-prefixed CSV with header, escapes commas and audits the export", async () => {
    prisma.subscription.findMany.mockResolvedValue([row]);
    const result = await exportSubscriptionsCsv({
      filter: { statuses: ["ACTIVE"] },
    });
    expect(result.success).toBe(true);
    const { csv, rowCount, filename } = result.data!;
    expect(rowCount).toBe(1);
    expect(filename).toMatch(/^subscriptions-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv.startsWith("﻿")).toBe(true);
    const [header, line] = csv.replace("﻿", "").split("\n");
    expect(header).toContain("Monthly (AED)");
    expect(line).toContain('"Slack, Inc"');
    expect(line).toContain("Productivity / Chat");
    expect(line).toContain("ENG");
    expect(line).toContain(",100,"); // 1200 / 12
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "EXPORT_SUBSCRIPTIONS",
          metadata: expect.objectContaining({ rowCount: 1 }),
        }),
      })
    );
  });

  it("intersects explicit ids with the filter", async () => {
    prisma.subscription.findMany.mockResolvedValue([]);
    await exportSubscriptionsCsv({ ids: ["s1", "s2"] });
    const where = JSON.stringify(
      prisma.subscription.findMany.mock.calls[0][0].where
    );
    expect(where).toContain('"id":{"in":["s1","s2"]}');
  });

  it("refuses exports above the row cap and requires the export permission", async () => {
    getSetting.mockResolvedValue(1);
    prisma.subscription.findMany.mockResolvedValue([row, { ...row, id: "s2" }]);
    const capped = await exportSubscriptionsCsv({});
    expect(capped.success).toBe(false);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();

    requirePermission.mockRejectedValue(
      new FakeForbidden("subscriptions:export")
    );
    expect((await exportSubscriptionsCsv({})).success).toBe(false);
  });
});

describe("exportCategorySpendCsv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermission.mockResolvedValue(permissionResult(ALL_READ));
    prisma.user.findUnique.mockResolvedValue({ teamId: null });
    prisma.category.findMany.mockResolvedValue([]);
    prisma.auditLog.create.mockResolvedValue({});
    prisma.subscription.findMany.mockResolvedValue([
      {
        amount: 30,
        currency: "AED",
        billingCycle: "MONTHLY",
        category: { id: "c1", name: "Chat", color: null, parentId: null },
      },
    ]);
  });

  it("writes category rows and audits with EXPORT_CATEGORY_SPEND", async () => {
    const result = await exportCategorySpendCsv({ teamId: "t1" });
    expect(result.success).toBe(true);
    expect(result.data!.csv).toContain("Chat,,30,360,1");
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "EXPORT_CATEGORY_SPEND" }),
      })
    );
  });

  it("requires reports:export", async () => {
    requirePermission.mockRejectedValue(new FakeForbidden("reports:export"));
    expect((await exportCategorySpendCsv({})).success).toBe(false);
  });
});
