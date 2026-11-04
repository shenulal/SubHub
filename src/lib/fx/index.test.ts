import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings/service";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { convertAmount, getBillingCycleMonths, normalizeToBase } from "./index";
import { getRate } from "./rates";

vi.mock("@/lib/db", () => ({
  prisma: { billingCycleConfig: { findMany: vi.fn() } },
}));
vi.mock("@/lib/settings/service", () => ({ getSettings: vi.fn() }));
vi.mock("./rates", async () => {
  const actual = await vi.importActual<typeof import("./rates")>("./rates");
  return { ...actual, getRate: vi.fn() };
});

const mockedGetRate = getRate as unknown as ReturnType<typeof vi.fn>;
const mockedSettings = getSettings as unknown as ReturnType<typeof vi.fn>;
const mockedCycles = prisma.billingCycleConfig
  .findMany as unknown as ReturnType<typeof vi.fn>;

describe("convertAmount", () => {
  beforeEach(() => vi.clearAllMocks());

  it("multiplies by the rate and rounds to the target currency precision", async () => {
    mockedGetRate.mockResolvedValue({
      rate: 3.6725,
      asOf: new Date(),
      stale: false,
      source: "api",
    });
    const result = await convertAmount(100, "USD", "AED");
    expect(result).toEqual({ amount: 367.25, rate: 3.6725, stale: false });
  });

  it("uses zero decimals for KRW and honours overrides", async () => {
    mockedGetRate.mockResolvedValue({
      rate: 1380.456,
      asOf: null,
      stale: true,
      source: "none",
    });
    expect((await convertAmount(1, "USD", "KRW")).amount).toBe(1380);
    expect((await convertAmount(1, "USD", "KRW", { decimals: 1 })).amount).toBe(
      1380.5
    );
  });
});

describe("getBillingCycleMonths", () => {
  it("falls back to 1/3/12/0 and applies configured overrides", async () => {
    mockedCycles.mockResolvedValue([{ cycle: "QUARTERLY", months: 4 }]);
    expect(await getBillingCycleMonths("org-1")).toEqual({
      MONTHLY: 1,
      QUARTERLY: 4,
      YEARLY: 12,
      ONE_TIME: 0,
    });
  });
});

describe("normalizeToBase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSettings.mockResolvedValue({
      "finance.baseCurrency": "AED",
      "finance.roundingDecimals": 2,
      "finance.fxStaleAfterDays": 7,
    });
    mockedCycles.mockResolvedValue([]);
  });

  it("converts each item to a monthly base amount and totals them", async () => {
    mockedGetRate.mockImplementation(async (from: string) => {
      if (from === "USD")
        return { rate: 3.6725, asOf: new Date(), stale: false, source: "api" };
      return { rate: 1, asOf: new Date(), stale: false, source: "identity" };
    });
    const result = await normalizeToBase("org-1", [
      { amount: 120, currency: "USD", billingCycle: "YEARLY" },
      { amount: 36.725, currency: "AED", billingCycle: "MONTHLY" },
      { amount: 500, currency: "USD", billingCycle: "ONE_TIME" },
    ]);
    expect(result.baseCurrency).toBe("AED");
    expect(result.items.map((i) => i.monthlyBase)).toEqual([36.73, 36.73, 0]);
    expect(result.monthlyTotal).toBe(73.46);
    expect(result.annualTotal).toBe(881.52);
    expect(result.stale).toBe(false);
  });

  it("looks up each currency pair only once and propagates staleness", async () => {
    mockedGetRate.mockResolvedValue({
      rate: 1,
      asOf: null,
      stale: true,
      source: "none",
    });
    const result = await normalizeToBase("org-1", [
      { amount: 10, currency: "GBP", billingCycle: "MONTHLY" },
      { amount: 20, currency: "gbp", billingCycle: "MONTHLY" },
    ]);
    expect(mockedGetRate).toHaveBeenCalledTimes(1);
    expect(result.stale).toBe(true);
    expect(result.monthlyTotal).toBe(30);
  });
});
