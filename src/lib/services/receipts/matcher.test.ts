// src/lib/services/receipts/matcher.test.ts
import { prisma } from "@/lib/db";
import { findSimilarSubscriptions } from "@/lib/services/subscription/duplicates";
import type { ParsedReceipt } from "@/types/receipts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadKnownVendors,
  matchExistingSubscription,
  priceChangePercent,
} from "./matcher";

vi.mock("@/lib/db", () => ({ prisma: { saaSCatalog: { findMany: vi.fn() } } }));
vi.mock("@/lib/services/subscription/duplicates", () => ({
  findSimilarSubscriptions: vi.fn(),
}));

const similar = findSimilarSubscriptions as unknown as ReturnType<typeof vi.fn>;
const catalog = (
  prisma as unknown as { saaSCatalog: { findMany: ReturnType<typeof vi.fn> } }
).saaSCatalog.findMany;

const parsed = (overrides: Partial<ParsedReceipt> = {}): ParsedReceipt => ({
  vendorName: "Notion",
  vendorDomain: "notion.so",
  catalogId: null,
  senderEmail: "team@notion.so",
  amount: 12,
  currency: "USD",
  billingCycle: "MONTHLY",
  chargedAt: null,
  nextRenewalAt: null,
  isTrial: false,
  confidence: 0.9,
  signals: {} as ParsedReceipt["signals"],
  ...overrides,
});

describe("matcher", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads active catalog vendors with aliases", async () => {
    catalog.mockResolvedValue([
      { id: "c1", name: "Slack", aliases: null, website: "https://slack.com" },
    ]);
    await expect(loadKnownVendors()).resolves.toEqual([
      { id: "c1", name: "Slack", aliases: [], website: "https://slack.com" },
    ]);
    expect(catalog).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } })
    );
  });

  it("returns null without a vendor or without a match above threshold", async () => {
    expect(
      await matchExistingSubscription("o", parsed({ vendorName: null }), 0.8)
    ).toBeNull();
    expect(similar).not.toHaveBeenCalled();
    similar.mockResolvedValue([
      {
        subscriptionId: "s",
        appName: "Notion",
        similarity: 0.5,
        amount: 12,
        currency: "USD",
      },
    ]);
    expect(await matchExistingSubscription("o", parsed(), 0.8)).toBeNull();
    similar.mockResolvedValue([]);
    expect(await matchExistingSubscription("o", parsed(), 0.8)).toBeNull();
  });

  it("flags duplicates only when amount and currency agree", async () => {
    similar.mockResolvedValue([
      {
        subscriptionId: "s",
        appName: "Notion",
        similarity: 0.95,
        amount: 12,
        currency: "usd",
      },
    ]);
    expect(await matchExistingSubscription("o", parsed(), 0.8)).toMatchObject({
      subscriptionId: "s",
      isDuplicate: true,
    });
    expect(
      await matchExistingSubscription("o", parsed({ amount: 13 }), 0.8)
    ).toMatchObject({ isDuplicate: false });
    expect(
      await matchExistingSubscription("o", parsed({ currency: "AED" }), 0.8)
    ).toMatchObject({ isDuplicate: false });
    expect(
      await matchExistingSubscription("o", parsed({ amount: null }), 0.8)
    ).toMatchObject({ isDuplicate: false });
    expect(similar).toHaveBeenCalledWith(
      "o",
      expect.objectContaining({ name: "Notion", vendorDomain: "notion.so" }),
      { threshold: 0.8 }
    );
  });

  it("computes percentage change", () => {
    expect(priceChangePercent(10, 12)).toBe(20);
    expect(priceChangePercent(12, 10)).toBe(16.67);
    expect(priceChangePercent(0, 10)).toBe(0);
  });
});
