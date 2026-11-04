// src/actions/discovery/pipeline.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ALL_READ, FakeForbidden, permissionResult } from "./test-helpers";

const { prisma, requirePermission, getSettings, convertAmount } = vi.hoisted(
  () => {
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
    const convertAmount = vi.fn();
    return { prisma, requirePermission, getSettings, convertAmount };
  }
);

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
  convertAmount: (...args: unknown[]) => convertAmount(...args),
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

import { getRenewalPipeline } from "./pipeline";

const DAY = 86_400_000;
function sub(id: string, patch: Record<string, unknown>) {
  return {
    id,
    appId: `app-${id}`,
    status: "ACTIVE",
    billingCycle: "MONTHLY",
    amount: 100,
    currency: "AED",
    renewalDate: null,
    trialEndsAt: null,
    cancellationDeadline: null,
    isTrial: false,
    isPersonal: false,
    app: { name: id, customLogoUrl: null, catalog: null },
    owner: { id: "u1", name: "Sara" },
    team: { name: "Ops" },
    ...patch,
  };
}

describe("getRenewalPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-04T10:00:00Z"));
    requirePermission.mockResolvedValue(permissionResult(ALL_READ));
    getSettings.mockResolvedValue({
      "discovery.pipelineWeekDays": 7,
      "discovery.pipelineMonthDays": 30,
      "discovery.pipelineOverdueGraceDays": 0,
    });
    prisma.user.findUnique.mockResolvedValue({ teamId: null });
    convertAmount.mockResolvedValue({ amount: 0.27, rate: 0.27, stale: false });
  });

  it("buckets renewals, trials and notices with base-currency totals", async () => {
    const now = Date.now();
    prisma.subscription.findMany
      .mockResolvedValueOnce([
        sub("overdue", { renewalDate: new Date(now - 2 * DAY) }),
        sub("week", {
          renewalDate: new Date(now + 3 * DAY),
          currency: "USD",
          billingCycle: "YEARLY",
          amount: 1200,
        }),
        sub("month", { renewalDate: new Date(now + 20 * DAY) }),
        sub("later", { renewalDate: new Date(now + 60 * DAY) }),
      ])
      .mockResolvedValueOnce([
        sub("trial", { isTrial: true, trialEndsAt: new Date(now + 5 * DAY) }),
      ])
      .mockResolvedValueOnce([
        sub("notice", { cancellationDeadline: new Date(now + 9 * DAY) }),
      ]);

    const result = await getRenewalPipeline();
    expect(result.success).toBe(true);
    const lanes = Object.fromEntries(result.data!.lanes.map((l) => [l.key, l]));
    expect(lanes.overdue.cards[0]).toMatchObject({
      id: "overdue",
      daysLeft: -2,
    });
    expect(lanes.week.cards[0]).toMatchObject({
      id: "week",
      monthlyBase: 27,
      annualBase: 324,
    });
    expect(lanes.month.count).toBe(1);
    expect(lanes.later.count).toBe(1);
    expect(lanes.trialEnding.cards[0]).toMatchObject({
      id: "trial",
      daysLeft: 5,
      isTrial: true,
    });
    expect(lanes.noticeDeadline.cards[0].daysLeft).toBe(9);
    expect(result.data).toMatchObject({
      baseCurrency: "AED",
      weekDays: 7,
      monthDays: 30,
      hasStaleRates: false,
    });
    expect(convertAmount).toHaveBeenCalledTimes(1); // one rate lookup per foreign currency
  });

  it("flags stale rates and honours an explicit scope", async () => {
    convertAmount.mockResolvedValue({ amount: 1, rate: 1, stale: true });
    prisma.subscription.findMany
      .mockResolvedValueOnce([
        sub("x", { renewalDate: new Date(Date.now() + DAY), currency: "USD" }),
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const result = await getRenewalPipeline({ scope: "personal" });
    expect(result.data!.hasStaleRates).toBe(true);
    const where = prisma.subscription.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('"isPersonal":true');
  });

  it("rejects an invalid scope and maps forbidden errors", async () => {
    expect((await getRenewalPipeline({ scope: "galaxy" })).success).toBe(false);
    requirePermission.mockRejectedValue(
      new FakeForbidden("subscriptions:read")
    );
    expect((await getRenewalPipeline()).success).toBe(false);
  });
});
