// src/lib/services/approval/policy-matcher.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { matchPolicy, policyRuleMatches } from "./policy-matcher";

const prisma = vi.hoisted(() => ({
  approvalPolicy: { findMany: vi.fn() },
  exchangeRate: { findFirst: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

function policy(overrides: Record<string, unknown>) {
  return {
    id: "p1",
    organizationId: "org",
    name: "Policy",
    description: null,
    isActive: true,
    priority: 1,
    appliesToAll: false,
    costThreshold: null,
    costThresholdCurrency: "AED",
    categoryIds: [] as string[],
    reminderAfterDays: null,
    escalationAfterDays: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    steps: [],
    ...overrides,
  };
}

describe("policyRuleMatches", () => {
  const input = { monthlyAmount: 100, currency: "AED", categoryId: "cat-1" };

  it("matches when appliesToAll is set", () => {
    expect(policyRuleMatches(policy({ appliesToAll: true }), input, 0)).toBe(
      true
    );
  });

  it("matches a threshold when the converted monthly amount is at or above it", () => {
    const p = policy({ costThreshold: 100 });
    expect(policyRuleMatches(p, input, 100)).toBe(true);
    expect(policyRuleMatches(p, input, 99.99)).toBe(false);
  });

  it("matches a category rule only for listed categories", () => {
    const p = policy({ categoryIds: ["cat-1"] });
    expect(policyRuleMatches(p, input, 0)).toBe(true);
    expect(policyRuleMatches(p, { ...input, categoryId: "other" }, 0)).toBe(
      false
    );
    expect(policyRuleMatches(p, { ...input, categoryId: null }, 0)).toBe(false);
  });

  it("requires both rules when threshold and categories are configured", () => {
    const p = policy({ costThreshold: 50, categoryIds: ["cat-1"] });
    expect(policyRuleMatches(p, input, 60)).toBe(true);
    expect(policyRuleMatches(p, input, 40)).toBe(false);
    expect(policyRuleMatches(p, { ...input, categoryId: "x" }, 60)).toBe(false);
  });

  it("never matches a policy with no rule", () => {
    expect(policyRuleMatches(policy({}), input, 1000)).toBe(false);
  });
});

describe("matchPolicy", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.exchangeRate.findFirst.mockResolvedValue(null);
  });

  it("returns null when no active policy matches", async () => {
    prisma.approvalPolicy.findMany.mockResolvedValue([
      policy({ costThreshold: 500 }),
    ]);
    const result = await matchPolicy("org", {
      monthlyAmount: 100,
      currency: "AED",
      categoryId: null,
    });
    expect(result).toBeNull();
  });

  it("returns the first matching policy in priority order", async () => {
    prisma.approvalPolicy.findMany.mockResolvedValue([
      policy({ id: "high", priority: 10, costThreshold: 500 }),
      policy({ id: "mid", priority: 5, categoryIds: ["cat-1"] }),
      policy({ id: "catch-all", priority: 0, appliesToAll: true }),
    ]);
    const result = await matchPolicy("org", {
      monthlyAmount: 100,
      currency: "AED",
      categoryId: "cat-1",
    });
    expect(result?.id).toBe("mid");
  });

  it("converts the monthly amount into the policy currency before comparing", async () => {
    prisma.approvalPolicy.findMany.mockResolvedValue([
      policy({ id: "usd", costThreshold: 100, costThresholdCurrency: "USD" }),
    ]);
    // 1 AED = 0.27 USD → 300 AED ≈ 81 USD, below the threshold
    prisma.exchangeRate.findFirst.mockResolvedValueOnce({ rate: 0.27 });
    const below = await matchPolicy("org", {
      monthlyAmount: 300,
      currency: "AED",
      categoryId: null,
    });
    expect(below).toBeNull();

    prisma.exchangeRate.findFirst.mockResolvedValueOnce({ rate: 0.27 });
    const above = await matchPolicy("org", {
      monthlyAmount: 400,
      currency: "AED",
      categoryId: null,
    });
    expect(above?.id).toBe("usd");
    expect(prisma.exchangeRate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { baseCurrency: "AED", quoteCurrency: "USD" },
      })
    );
  });

  it("falls back to the inverse rate, then rate 1", async () => {
    prisma.approvalPolicy.findMany.mockResolvedValue([
      policy({ id: "usd", costThreshold: 100, costThresholdCurrency: "USD" }),
    ]);
    prisma.exchangeRate.findFirst
      .mockResolvedValueOnce(null) // direct
      .mockResolvedValueOnce({ rate: 4 }); // inverse USD→AED
    const result = await matchPolicy("org", {
      monthlyAmount: 300,
      currency: "AED",
      categoryId: null,
    });
    expect(result).toBeNull(); // 300 / 4 = 75 < 100

    prisma.exchangeRate.findFirst.mockResolvedValue(null);
    const noRate = await matchPolicy("org", {
      monthlyAmount: 300,
      currency: "AED",
      categoryId: null,
    });
    expect(noRate?.id).toBe("usd"); // rate 1 → 300 >= 100
  });
});
