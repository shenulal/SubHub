import { describe, expect, it } from "vitest";
import {
  currencyDecimals,
  formatMoney,
  roundTo,
  toMonthlyAmount,
} from "./convert";

describe("toMonthlyAmount", () => {
  it("returns the amount unchanged for monthly billing", () => {
    expect(toMonthlyAmount(120, "MONTHLY")).toBe(120);
  });

  it("divides quarterly and yearly amounts by their default months", () => {
    expect(toMonthlyAmount(300, "QUARTERLY")).toBe(100);
    expect(toMonthlyAmount(1200, "YEARLY")).toBe(100);
  });

  it("contributes nothing for one-time charges", () => {
    expect(toMonthlyAmount(999, "ONE_TIME")).toBe(0);
  });

  it("honours organisation-configured months per cycle", () => {
    expect(toMonthlyAmount(600, "QUARTERLY", 6)).toBe(100);
  });

  it("returns 0 for zero or negative months and non-finite amounts", () => {
    expect(toMonthlyAmount(100, "MONTHLY", 0)).toBe(0);
    expect(toMonthlyAmount(Number.NaN, "MONTHLY")).toBe(0);
  });
});

describe("currencyDecimals / roundTo", () => {
  it("uses zero decimals for KRW, JPY, IDR, VND", () => {
    for (const code of ["KRW", "JPY", "IDR", "VND", "krw"]) {
      expect(currencyDecimals(code)).toBe(0);
    }
    expect(currencyDecimals("AED")).toBe(2);
  });

  it("lets callers override the precision", () => {
    expect(currencyDecimals("AED", 4)).toBe(4);
    expect(currencyDecimals("KRW", 2)).toBe(2);
  });

  it("rounds without float drift", () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(-1.005, 2)).toBe(-1.01);
    expect(roundTo(2.5, 0)).toBe(3);
    expect(roundTo(Number.POSITIVE_INFINITY, 2)).toBe(0);
  });
});

describe("formatMoney", () => {
  it("formats two-decimal currencies", () => {
    expect(formatMoney(1234.5, "AED", "en").replace(/\u00a0/g, " ")).toBe(
      "AED 1,234.50"
    );
    expect(formatMoney(1234.5, "USD", "en")).toBe("$1,234.50");
  });

  it("formats zero-decimal currencies without minor units", () => {
    expect(formatMoney(12345, "KRW", "en")).toBe("₩12,345");
    expect(formatMoney(12345.6, "JPY", "en")).toBe("¥12,346");
  });

  it("respects an explicit decimals override", () => {
    expect(formatMoney(1.23456, "USD", "en", 4)).toBe("$1.2346");
  });

  it("falls back gracefully for unknown codes and NaN", () => {
    expect(formatMoney(10, "ZZZ1", "en")).toBe("10.00 ZZZ1");
    expect(formatMoney(Number.NaN, "USD", "en")).toBe("$0.00");
  });
});
