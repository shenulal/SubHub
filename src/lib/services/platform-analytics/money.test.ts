// src/lib/services/platform-analytics/money.test.ts
// Uses the real BaseConverter + FX convert; only the rate lookup is stubbed.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/settings/service", () => ({ getSettings: vi.fn() }));
vi.mock("@/lib/fx/rates", () => ({
  PIVOT_CURRENCY: "USD",
  getRate: vi.fn(),
}));

import { getRate } from "@/lib/fx/rates";

import { SpendConverter } from "./money";

const USD_AED = 3.6725;

beforeEach(() => {
  vi.mocked(getRate).mockImplementation(async (from: string, to: string) => {
    const rate =
      from === to
        ? 1
        : from === "USD" && to === "AED"
          ? USD_AED
          : from === "AED" && to === "USD"
            ? 1 / USD_AED
            : 1;
    return { rate, asOf: new Date(), stale: false, source: "test" };
  });
});

const QA_SUBSCRIPTIONS = [
  // Slack: USD 420 / month
  {
    organizationId: "o1",
    currency: "USD",
    billingCycle: "MONTHLY",
    amount: 420,
  },
  // Figma: AED 1,500 / year
  {
    organizationId: "o1",
    currency: "AED",
    billingCycle: "YEARLY",
    amount: 1500,
  },
  // Notion: USD 96 / month
  {
    organizationId: "o1",
    currency: "USD",
    billingCycle: "MONTHLY",
    amount: 96,
  },
];

describe("SpendConverter", () => {
  it("sums mixed USD and AED subscriptions correctly in AED", async () => {
    const converter = new SpendConverter("AED", []);
    const converted = await converter.monthlyAll(QA_SUBSCRIPTIONS);
    const total = converter.round(converted.reduce((s, x) => s + x.monthly, 0));
    // 420 × 3.6725 + 1500 / 12 + 96 × 3.6725 = 1542.45 + 125 + 352.56
    expect(total).toBe(2020.01);
    expect(converted.map((x) => converter.round(x.monthly))).toEqual([
      1542.45, 125, 352.56,
    ]);
    expect(converter.hasStaleRates).toBe(false);
  });

  it("uses each organisation's billing-cycle configuration", async () => {
    const converter = new SpendConverter("AED", [
      { organizationId: "o2", cycle: "YEARLY", months: 10 },
    ]);
    const [o1, o2] = await converter.monthlyAll([
      {
        organizationId: "o1",
        currency: "AED",
        billingCycle: "YEARLY",
        amount: 1200,
      },
      {
        organizationId: "o2",
        currency: "AED",
        billingCycle: "YEARLY",
        amount: 1200,
      },
    ]);
    expect(o1.monthly).toBe(100);
    expect(o2.monthly).toBe(120);
  });

  it("converts into another target currency and flags stale rates", async () => {
    vi.mocked(getRate).mockResolvedValueOnce({
      rate: 1 / USD_AED,
      asOf: null,
      stale: true,
      source: "none",
    });
    const converter = new SpendConverter("USD", []);
    const [figma] = await converter.monthlyAll([QA_SUBSCRIPTIONS[1]]);
    expect(converter.round(figma.monthly)).toBe(34.04);
    expect(converter.hasStaleRates).toBe(true);
  });

  it("ignores one-time charges in the monthly run-rate", async () => {
    const converter = new SpendConverter("AED", []);
    const [one] = await converter.monthlyAll([
      {
        organizationId: "o1",
        currency: "AED",
        billingCycle: "ONE_TIME",
        amount: 999,
      },
    ]);
    expect(one.monthly).toBe(0);
  });
});
