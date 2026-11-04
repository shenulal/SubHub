import { prisma } from "@/lib/db";
import { notify } from "@/lib/services/notification/center";
import { getSettings } from "@/lib/settings/service";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  exceedsThreshold,
  latestLinkedPayment,
  percentChange,
  processPriceChangeScan,
} from "./price-change-scan";

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: { findMany: vi.fn(), update: vi.fn() },
    paymentRecord: { findFirst: vi.fn() },
    cardTransaction: { findFirst: vi.fn() },
    priceChangeEvent: { findUnique: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/settings/service", () => ({ getSettings: vi.fn() }));
vi.mock("@/lib/services/notification/center", () => ({ notify: vi.fn() }));
vi.mock("./alert-support", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./alert-support")>();
  return {
    ...actual,
    listOrganizationIds: vi.fn(async () => ["org-1"]),
    resolveAlertRecipients: vi.fn(async () => ["owner-1", "admin-1"]),
  };
});

describe("percentChange / exceedsThreshold", () => {
  it("computes signed percentage change and applies the threshold", () => {
    expect(percentChange(100, 110)).toBe(10);
    expect(percentChange(100, 95)).toBe(-5);
    expect(percentChange(0, 10)).toBeNull();
    expect(exceedsThreshold(100, 105, 5)).toBe(true);
    expect(exceedsThreshold(100, 104.9, 5)).toBe(false);
    expect(exceedsThreshold(0, 10, 5)).toBe(false);
  });
});

describe("latestLinkedPayment", () => {
  beforeEach(() => vi.resetAllMocks());

  it("prefers the most recent comparable record across sources", async () => {
    vi.mocked(prisma.paymentRecord.findFirst).mockResolvedValue({
      id: "pr-1",
      amount: 120,
      currency: "AED",
      transactionDate: new Date("2026-10-01T00:00:00Z"),
    } as never);
    vi.mocked(prisma.cardTransaction.findFirst).mockResolvedValue({
      id: "ct-1",
      useAmt: 130,
      useDt: "20261015",
      useTm: "093000",
    } as never);
    const observed = await latestLinkedPayment(
      { id: "sub-1", currency: "AED" },
      "AED"
    );
    expect(observed).toMatchObject({
      source: "CARD_TRANSACTION",
      recordId: "ct-1",
      amount: 130,
      currency: "AED",
    });
  });

  it("ignores card transactions when the subscription is not in base currency", async () => {
    vi.mocked(prisma.paymentRecord.findFirst).mockResolvedValue(null);
    const observed = await latestLinkedPayment(
      { id: "sub-1", currency: "USD" },
      "AED"
    );
    expect(observed).toBeNull();
    expect(prisma.cardTransaction.findFirst).not.toHaveBeenCalled();
  });
});

describe("processPriceChangeScan", () => {
  const sub = {
    id: "sub-1",
    amount: 100,
    lastDetectedAmount: null,
    currency: "AED",
    ownerId: "owner-1",
    teamId: null,
    app: { name: "Slack" },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getSettings).mockResolvedValue({
      "subscriptions.priceChangeThresholdPercent": 5,
      "finance.baseCurrency": "AED",
    } as never);
    vi.mocked(prisma.subscription.findMany).mockResolvedValue([sub] as never);
    vi.mocked(prisma.cardTransaction.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.priceChangeEvent.create).mockResolvedValue({
      id: "evt-1",
    } as never);
  });

  it("creates an event, updates lastDetectedAmount, notifies and audits", async () => {
    vi.mocked(prisma.paymentRecord.findFirst).mockResolvedValue({
      id: "pr-1",
      amount: 110,
      currency: "AED",
      transactionDate: new Date("2026-11-01T00:00:00Z"),
    } as never);
    vi.mocked(prisma.priceChangeEvent.findUnique).mockResolvedValue(null);

    const result = await processPriceChangeScan();

    expect(prisma.priceChangeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subscriptionId: "sub-1",
          previousAmount: 100,
          newAmount: 110,
          changePercent: 10,
          source: "PAYMENT_RECORD",
          sourceRecordId: "pr-1",
        }),
      })
    );
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { lastDetectedAmount: 110 },
    });
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PRICE_CHANGE",
        userIds: ["owner-1", "admin-1"],
        title: "Slack price increased 10%",
        dedupeKey: "price:evt-1",
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "DETECT_PRICE_CHANGE",
          entityType: "price_change",
          entityId: "sub-1",
        }),
      })
    );
    expect(result).toMatchObject({ matched: 1, notified: 1, skipped: 0 });
  });

  it("ignores changes below the threshold", async () => {
    vi.mocked(prisma.paymentRecord.findFirst).mockResolvedValue({
      id: "pr-2",
      amount: 103,
      currency: "AED",
      transactionDate: new Date(),
    } as never);
    const result = await processPriceChangeScan();
    expect(prisma.priceChangeEvent.create).not.toHaveBeenCalled();
    expect(result.matched).toBe(0);
  });

  it("dedupes by source record and compares against lastDetectedAmount", async () => {
    vi.mocked(prisma.subscription.findMany).mockResolvedValue([
      { ...sub, lastDetectedAmount: 110 },
    ] as never);
    vi.mocked(prisma.paymentRecord.findFirst).mockResolvedValue({
      id: "pr-1",
      amount: 125,
      currency: "AED",
      transactionDate: new Date(),
    } as never);
    vi.mocked(prisma.priceChangeEvent.findUnique).mockResolvedValue({
      id: "existing",
    } as never);
    const result = await processPriceChangeScan();
    expect(prisma.priceChangeEvent.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ matched: 1, skipped: 1, notified: 0 });
  });
});
