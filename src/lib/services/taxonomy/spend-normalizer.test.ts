import { describe, expect, it } from "vitest";

import {
  bucketSpendByCategory,
  monthlyAmount,
  roundMoney,
} from "./spend-normalizer";

const cycles = { MONTHLY: 1, QUARTERLY: 3, YEARLY: 12, ONE_TIME: 0 };

describe("monthlyAmount", () => {
  it("divides by the configured cycle months", () => {
    expect(monthlyAmount(120, "YEARLY", cycles)).toBe(10);
    expect(monthlyAmount(30, "QUARTERLY", cycles)).toBe(10);
    expect(monthlyAmount(10, "MONTHLY", cycles)).toBe(10);
  });
  it("treats one-time and unknown cycles as non-recurring", () => {
    expect(monthlyAmount(500, "ONE_TIME", cycles)).toBe(0);
    expect(monthlyAmount(500, "BIENNIAL", cycles)).toBe(0);
  });
});

describe("bucketSpendByCategory", () => {
  it("groups, converts and sorts descending", () => {
    const rows = [
      { categoryId: "a", amount: 120, billingCycle: "YEARLY", currency: "USD" },
      { categoryId: "a", amount: 5, billingCycle: "MONTHLY", currency: "AED" },
      {
        categoryId: null,
        amount: 100,
        billingCycle: "MONTHLY",
        currency: "USD",
      },
    ];
    const buckets = bucketSpendByCategory(
      rows,
      cycles,
      (c) => (c === "AED" ? 0.5 : 1),
      "none"
    );
    expect(buckets).toEqual([
      { categoryId: "none", monthlyTotal: 100, count: 1 },
      { categoryId: "a", monthlyTotal: 12.5, count: 2 },
    ]);
  });
  it("rounds money to two decimals", () => {
    expect(roundMoney(10 / 3)).toBe(3.33);
  });
});
