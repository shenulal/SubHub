// src/lib/services/approval/cycle.test.ts
import { describe, expect, it, vi } from "vitest";
import {
  addDays,
  addMonths,
  computeMonthlyAmount,
  daysBetween,
  getCycleMonths,
  roundMoney,
} from "./cycle";

const prisma = vi.hoisted(() => ({
  billingCycleConfig: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma }));

describe("cycle helpers", () => {
  it("computes the monthly amount from cycle months", () => {
    expect(computeMonthlyAmount(1200, 12)).toBe(100);
    expect(computeMonthlyAmount(300, 3)).toBe(100);
    expect(computeMonthlyAmount(100, 1)).toBe(100);
    expect(computeMonthlyAmount(999, 0)).toBe(0);
    expect(computeMonthlyAmount(10, 3)).toBe(3.33);
  });

  it("rounds money to two decimals", () => {
    expect(roundMoney(1.005)).toBe(1);
    expect(roundMoney(83.4000001)).toBe(83.4);
  });

  it("adds months and days", () => {
    const base = new Date("2026-01-31T00:00:00Z");
    expect(addDays(base, 2).toISOString()).toBe("2026-02-02T00:00:00.000Z");
    expect(
      addMonths(new Date("2026-01-15T00:00:00Z"), 12).getUTCFullYear()
    ).toBe(2027);
    expect(daysBetween(base, addDays(base, 3))).toBe(3);
  });

  it("reads cycle months from BillingCycleConfig with in-code fallback", async () => {
    prisma.billingCycleConfig.findMany.mockResolvedValue([
      { cycle: "YEARLY", months: 10 },
    ]);
    const months = await getCycleMonths("org");
    expect(months.YEARLY).toBe(10);
    expect(months.MONTHLY).toBe(1);
    expect(months.QUARTERLY).toBe(3);
    expect(months.ONE_TIME).toBe(0);
  });
});
