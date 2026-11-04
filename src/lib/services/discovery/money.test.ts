// src/lib/services/discovery/money.test.ts
import { describe, expect, it } from "vitest";

import {
  formatMoneyCompact,
  monthsForCycle,
  roundMoney,
  toAnnualAmount,
} from "./money";

describe("money helpers", () => {
  it("resolves cycle months from master data with fallbacks", () => {
    expect(monthsForCycle("YEARLY")).toBe(12);
    expect(monthsForCycle("YEARLY", { YEARLY: 10 })).toBe(10);
    expect(monthsForCycle("ONE_TIME")).toBe(0);
  });

  it("annualises amounts and ignores one-time charges", () => {
    expect(toAnnualAmount(1200, "YEARLY")).toBe(1200);
    expect(toAnnualAmount(100, "MONTHLY")).toBe(1200);
    expect(toAnnualAmount(300, "QUARTERLY")).toBe(1200);
    expect(toAnnualAmount(999, "ONE_TIME")).toBe(0);
  });

  it("rounds to cents and formats compact money safely", () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(formatMoneyCompact(1500, "AED")).toMatch(/1\.5K/);
    expect(formatMoneyCompact(Number.NaN, "AED")).toMatch(/0/);
    expect(formatMoneyCompact(12, "ZZZ")).toContain("ZZZ");
  });
});
