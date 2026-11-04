// src/lib/services/receipts/scanner.test.ts
import { prisma } from "@/lib/db";
import { notify } from "@/lib/services/notification/center";
import { findSimilarSubscriptions } from "@/lib/services/subscription/duplicates";
import { getSettings } from "@/lib/settings/service";
import type { RawMessage } from "@/types/receipts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RECEIPT_FIXTURES } from "./parser.fixtures";
import { getProvider, MailboxProviderError } from "./providers";
import { scanAllMailboxes, scanMailbox } from "./scanner";

vi.mock("@/lib/db", () => ({
  prisma: {
    mailboxConnection: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    receiptSuggestion: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    priceChangeEvent: { findFirst: vi.fn(), create: vi.fn() },
    saaSCatalog: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/settings/service", () => ({ getSettings: vi.fn() }));
vi.mock("@/lib/services/notification/center", () => ({ notify: vi.fn() }));
vi.mock("@/lib/services/subscription/duplicates", () => ({
  findSimilarSubscriptions: vi.fn(),
}));
vi.mock("@/lib/crypto", () => ({
  encrypt: (v: string) => `enc:${v}`,
  decrypt: (v: string) => v.replace(/^enc:/, ""),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("./providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./providers")>();
  return { ...actual, getProvider: vi.fn() };
});

const db = prisma as unknown as Record<
  string,
  Record<string, ReturnType<typeof vi.fn>>
>;
const mockedSettings = getSettings as unknown as ReturnType<typeof vi.fn>;
const mockedSimilar = findSimilarSubscriptions as unknown as ReturnType<
  typeof vi.fn
>;
const mockedNotify = notify as unknown as ReturnType<typeof vi.fn>;
const mockedGetProvider = getProvider as unknown as ReturnType<typeof vi.fn>;

const NOW = new Date("2026-02-01T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

const notionMessage: RawMessage = RECEIPT_FIXTURES[0].message; // $12 monthly, conf ≥ 0.8
const lunchMessage: RawMessage = RECEIPT_FIXTURES[9].message; // no receipt signals

const baseConnection = {
  id: "conn-1",
  organizationId: "org-1",
  userId: "user-1",
  provider: "GMAIL" as const,
  email: "me@acme.com",
  accessToken: "enc:access",
  refreshToken: "enc:refresh",
  expiresAt: new Date(NOW.getTime() + DAY),
  status: "ACTIVE" as const,
  lastScannedAt: null as Date | null,
  cursor: null as string | null,
  errorMessage: null,
};

function provider(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "GMAIL",
    listCandidateMessages: vi
      .fn()
      .mockResolvedValue({ messages: [notionMessage], nextCursor: "h-2" }),
    refresh: vi
      .fn()
      .mockResolvedValue({
        accessToken: "new-access",
        refreshToken: "refresh",
        expiresAt: NOW.getTime() + DAY,
      }),
    ...overrides,
  };
}

function settings(overrides: Record<string, unknown> = {}) {
  mockedSettings.mockImplementation(
    async (_org: string, keys: readonly string[]) => {
      const all: Record<string, unknown> = {
        "integrations.mailboxLookbackDays": 90,
        "integrations.receiptMinConfidence": 0.6,
        "integrations.mailboxMaxMessagesPerScan": 100,
        "subscriptions.priceChangeThresholdPercent": 5,
        "subscriptions.duplicateSimilarityThreshold": 0.8,
        "integrations.mailboxScanIntervalHours": 6,
        ...overrides,
      };
      return Object.fromEntries(keys.map((k) => [k, all[k]]));
    }
  );
}

describe("scanMailbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settings();
    db.mailboxConnection.findUnique.mockResolvedValue({ ...baseConnection });
    db.mailboxConnection.update.mockResolvedValue({});
    db.receiptSuggestion.findUnique.mockResolvedValue(null);
    db.receiptSuggestion.create.mockResolvedValue({ id: "sug-1" });
    db.receiptSuggestion.update.mockResolvedValue({});
    db.priceChangeEvent.findFirst.mockResolvedValue(null);
    db.priceChangeEvent.create.mockResolvedValue({});
    db.saaSCatalog.findMany.mockResolvedValue([
      {
        id: "cat-notion",
        name: "Notion",
        aliases: ["Notion Labs"],
        website: "https://notion.so",
      },
    ]);
    mockedSimilar.mockResolvedValue([]);
  });

  it("uses the lookback window on the first run and persists cursor + lastScannedAt", async () => {
    const p = provider();
    mockedGetProvider.mockReturnValue(p);

    const result = await scanMailbox("conn-1", NOW);

    const opts = p.listCandidateMessages.mock.calls[0][1];
    expect(opts.since.getTime()).toBe(NOW.getTime() - 90 * DAY);
    expect(opts.cursor).toBeNull();
    expect(opts.maxResults).toBe(100);
    expect(result).toMatchObject({
      fetched: 1,
      parsed: 1,
      created: 1,
      belowThreshold: 0,
    });
    expect(db.receiptSuggestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mailboxId: "conn-1",
          messageId: "m1",
          vendorName: "Notion",
          amount: 12,
          currency: "USD",
          billingCycle: "MONTHLY",
          matchedCatalogId: "cat-notion",
          status: "NEW",
        }),
      })
    );
    expect(db.mailboxConnection.update).toHaveBeenLastCalledWith({
      where: { id: "conn-1" },
      data: {
        lastScannedAt: NOW,
        cursor: "h-2",
        status: "ACTIVE",
        errorMessage: null,
      },
    });
  });

  it("uses lastScannedAt and the stored cursor on later runs", async () => {
    const last = new Date(NOW.getTime() - 3 * DAY);
    db.mailboxConnection.findUnique.mockResolvedValue({
      ...baseConnection,
      lastScannedAt: last,
      cursor: "h-1",
    });
    const p = provider();
    mockedGetProvider.mockReturnValue(p);

    await scanMailbox("conn-1", NOW);

    const opts = p.listCandidateMessages.mock.calls[0][1];
    expect(opts.since).toEqual(last);
    expect(opts.cursor).toBe("h-1");
  });

  it("refreshes tokens that are about to expire and stores them encrypted", async () => {
    db.mailboxConnection.findUnique.mockResolvedValue({
      ...baseConnection,
      expiresAt: new Date(NOW.getTime() + 1000),
    });
    const p = provider();
    mockedGetProvider.mockReturnValue(p);

    await scanMailbox("conn-1", NOW);

    expect(p.refresh).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "access",
        refreshToken: "refresh",
      })
    );
    expect(db.mailboxConnection.update).toHaveBeenCalledWith({
      where: { id: "conn-1" },
      data: expect.objectContaining({
        accessToken: "enc:new-access",
        refreshToken: "enc:refresh",
      }),
    });
    expect(p.listCandidateMessages.mock.calls[0][0].accessToken).toBe(
      "new-access"
    );
  });

  it("drops messages below the confidence gate", async () => {
    mockedGetProvider.mockReturnValue(
      provider({
        listCandidateMessages: vi
          .fn()
          .mockResolvedValue({
            messages: [lunchMessage, notionMessage],
            nextCursor: null,
          }),
      })
    );

    const result = await scanMailbox("conn-1", NOW);

    expect(result.belowThreshold).toBe(1);
    expect(result.created).toBe(1);
    expect(db.receiptSuggestion.create).toHaveBeenCalledTimes(1);
  });

  it("honours a stricter organisation confidence setting", async () => {
    settings({ "integrations.receiptMinConfidence": 0.9 });
    const weak = RECEIPT_FIXTURES.find(
      (f) => f.name === "Receipt with no cycle words"
    )!.message;
    mockedGetProvider.mockReturnValue(
      provider({
        listCandidateMessages: vi
          .fn()
          .mockResolvedValue({ messages: [weak], nextCursor: null }),
      })
    );

    const result = await scanMailbox("conn-1", NOW);

    expect(result.belowThreshold).toBe(1);
    expect(db.receiptSuggestion.create).not.toHaveBeenCalled();
  });

  it("updates an existing NEW suggestion instead of creating a duplicate row", async () => {
    db.receiptSuggestion.findUnique.mockResolvedValue({
      id: "sug-old",
      status: "NEW",
    });
    mockedGetProvider.mockReturnValue(provider());

    const result = await scanMailbox("conn-1", NOW);

    expect(result).toMatchObject({ created: 0, updated: 1 });
    expect(db.receiptSuggestion.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sug-old" } })
    );
    expect(mockedNotify).not.toHaveBeenCalled();
  });

  it("never overwrites a suggestion the user already decided on", async () => {
    db.receiptSuggestion.findUnique.mockResolvedValue({
      id: "sug-old",
      status: "ACCEPTED",
    });
    mockedGetProvider.mockReturnValue(provider());

    const result = await scanMailbox("conn-1", NOW);

    expect(result).toMatchObject({ created: 0, updated: 0 });
    expect(db.receiptSuggestion.update).not.toHaveBeenCalled();
  });

  it("marks DUPLICATE when a similar subscription has the same amount and currency", async () => {
    mockedSimilar.mockResolvedValue([
      {
        subscriptionId: "sub-1",
        appName: "Notion",
        similarity: 0.95,
        reason: "name",
        status: "ACTIVE",
        amount: 12,
        currency: "USD",
      },
    ]);
    mockedGetProvider.mockReturnValue(provider());

    const result = await scanMailbox("conn-1", NOW);

    expect(result.duplicates).toBe(1);
    expect(db.receiptSuggestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DUPLICATE",
          matchedSubscriptionId: "sub-1",
        }),
      })
    );
    expect(db.priceChangeEvent.create).not.toHaveBeenCalled();
  });

  it("records a price change when the receipt amount drifts beyond the threshold", async () => {
    mockedSimilar.mockResolvedValue([
      {
        subscriptionId: "sub-1",
        appName: "Notion",
        similarity: 0.95,
        reason: "name",
        status: "ACTIVE",
        amount: 10,
        currency: "USD",
      },
    ]);
    mockedGetProvider.mockReturnValue(provider());

    const result = await scanMailbox("conn-1", NOW);

    expect(result.priceChanges).toBe(1);
    expect(db.priceChangeEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subscriptionId: "sub-1",
        previousAmount: 10,
        newAmount: 12,
        changePercent: 20,
        source: "EMAIL_RECEIPT",
        sourceRecordId: "m1",
      }),
    });
    // Not a duplicate (amount differs) but still linked for review.
    expect(db.receiptSuggestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "NEW",
          matchedSubscriptionId: "sub-1",
        }),
      })
    );
  });

  it("does not record a price change twice for the same message", async () => {
    mockedSimilar.mockResolvedValue([
      {
        subscriptionId: "sub-1",
        appName: "Notion",
        similarity: 0.95,
        reason: "name",
        status: "ACTIVE",
        amount: 10,
        currency: "USD",
      },
    ]);
    db.priceChangeEvent.findFirst.mockResolvedValue({ id: "pce-1" });
    mockedGetProvider.mockReturnValue(provider());

    const result = await scanMailbox("conn-1", NOW);

    expect(result.priceChanges).toBe(0);
    expect(db.priceChangeEvent.create).not.toHaveBeenCalled();
  });

  it("ignores drift below the threshold and across currencies", async () => {
    settings({ "subscriptions.priceChangeThresholdPercent": 25 });
    mockedSimilar.mockResolvedValue([
      {
        subscriptionId: "sub-1",
        appName: "Notion",
        similarity: 0.95,
        reason: "name",
        status: "ACTIVE",
        amount: 10,
        currency: "USD",
      },
    ]);
    mockedGetProvider.mockReturnValue(provider());
    expect((await scanMailbox("conn-1", NOW)).priceChanges).toBe(0);

    settings();
    mockedSimilar.mockResolvedValue([
      {
        subscriptionId: "sub-1",
        appName: "Notion",
        similarity: 0.95,
        reason: "name",
        status: "ACTIVE",
        amount: 10,
        currency: "AED",
      },
    ]);
    expect((await scanMailbox("conn-1", NOW)).priceChanges).toBe(0);
  });

  it("notifies the owner once per scan day when new suggestions appear", async () => {
    mockedGetProvider.mockReturnValue(provider());

    await scanMailbox("conn-1", NOW);

    expect(mockedNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        userIds: ["user-1"],
        type: "RECEIPT_SUGGESTION",
        dedupeKey: "receipt-scan:conn-1:2026-02-01",
        link: "/subscriptions/receipts",
      })
    );
  });

  it("flags the connection as ERROR when the provider fails", async () => {
    mockedGetProvider.mockReturnValue(
      provider({
        listCandidateMessages: vi
          .fn()
          .mockRejectedValue(new Error("Gmail quota exceeded")),
      })
    );

    const result = await scanMailbox("conn-1", NOW);

    expect(result.error).toBe("Gmail quota exceeded");
    expect(db.mailboxConnection.update).toHaveBeenCalledWith({
      where: { id: "conn-1" },
      data: { status: "ERROR", errorMessage: "Gmail quota exceeded" },
    });
    expect(db.receiptSuggestion.create).not.toHaveBeenCalled();
  });

  it("flags the connection as REVOKED on an auth failure", async () => {
    mockedGetProvider.mockReturnValue(
      provider({
        listCandidateMessages: vi
          .fn()
          .mockRejectedValue(new MailboxProviderError("invalid_grant", "AUTH")),
      })
    );

    await scanMailbox("conn-1", NOW);

    expect(db.mailboxConnection.update).toHaveBeenCalledWith({
      where: { id: "conn-1" },
      data: { status: "REVOKED", errorMessage: "invalid_grant" },
    });
  });

  it("returns an error for unknown or revoked connections without calling the provider", async () => {
    db.mailboxConnection.findUnique.mockResolvedValueOnce(null);
    expect((await scanMailbox("missing", NOW)).error).toMatch(/not found/);

    db.mailboxConnection.findUnique.mockResolvedValueOnce({
      ...baseConnection,
      status: "REVOKED",
    });
    expect((await scanMailbox("conn-1", NOW)).error).toMatch(/revoked/);
    expect(mockedGetProvider).not.toHaveBeenCalled();
  });
});

describe("scanAllMailboxes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settings();
    db.mailboxConnection.update.mockResolvedValue({});
    db.receiptSuggestion.findUnique.mockResolvedValue(null);
    db.receiptSuggestion.create.mockResolvedValue({ id: "sug" });
    db.saaSCatalog.findMany.mockResolvedValue([]);
    mockedSimilar.mockResolvedValue([]);
    mockedGetProvider.mockReturnValue(
      provider({
        listCandidateMessages: vi
          .fn()
          .mockResolvedValue({ messages: [], nextCursor: null }),
      })
    );
  });

  it("scans only connections whose last scan is older than the interval", async () => {
    const HOUR = 60 * 60 * 1000;
    db.mailboxConnection.findMany.mockResolvedValue([
      { id: "due-never", organizationId: "org-1", lastScannedAt: null },
      {
        id: "due-old",
        organizationId: "org-1",
        lastScannedAt: new Date(NOW.getTime() - 7 * HOUR),
      },
      {
        id: "fresh",
        organizationId: "org-1",
        lastScannedAt: new Date(NOW.getTime() - 1 * HOUR),
      },
    ]);
    db.mailboxConnection.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => ({
        ...baseConnection,
        id: where.id,
      })
    );

    const summary = await scanAllMailboxes(NOW);

    expect(summary.scanned).toBe(2);
    expect(summary.skipped).toBe(1);
    expect(summary.errors).toBe(0);
    expect(db.mailboxConnection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ["ACTIVE", "ERROR"] } },
      })
    );
  });

  it("counts failed scans as errors and keeps going", async () => {
    db.mailboxConnection.findMany.mockResolvedValue([
      { id: "a", organizationId: "org-1", lastScannedAt: null },
      { id: "b", organizationId: "org-1", lastScannedAt: null },
    ]);
    db.mailboxConnection.findUnique
      .mockResolvedValueOnce({ ...baseConnection, id: "a" })
      .mockResolvedValueOnce(null);

    const summary = await scanAllMailboxes(NOW);

    expect(summary.scanned).toBe(2);
    expect(summary.errors).toBe(1);
  });
});
