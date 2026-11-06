// src/actions/cards/card-sync.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock setup (declared before imports)
vi.mock("@/lib/rbac/service", async () =>
  (await import("@/test/rbac-org-mock")).orgRbacMock()
);
vi.mock("@/lib/fx/base-currency", () => ({
  getBaseCurrency: vi.fn().mockResolvedValue("KRW"),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    corporateCard: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    app: {
      findMany: vi.fn(),
    },
    saaSCatalog: {
      findMany: vi.fn(),
    },
    merchantPattern: {
      findMany: vi.fn(),
    },
    cardTransaction: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  getCachedSession: vi.fn(),
}));

vi.mock("@/lib/crypto", () => ({
  decryptJson: vi.fn().mockReturnValue({
    cardNo: "1234567890123456",
    corpId: "corp-1",
    corpNo: "1234567890",
  }),
}));

vi.mock("@/lib/services/hyphen", () => ({
  getCardApprovals: vi.fn(),
  getLastNDaysRange: vi.fn().mockReturnValue({
    sdate: "20250101",
    edate: "20250131",
  }),
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

vi.mock("@/lib/services/payment/merchant-matcher", () => ({
  matchMerchant4LayerSync: vi.fn(),
  normalizeMerchantName: vi.fn((name: string) => name.toLowerCase().trim()),
}));

vi.mock("@/lib/services/saas-matcher", () => ({
  checkNonSaaSCache: vi.fn().mockResolvedValue(new Set()),
  findNonSaaSKeywordHit: vi.fn().mockReturnValue(null),
  matchMerchantWithLLM: vi.fn(),
  saveNonSaaSVendors: vi.fn(),
}));

vi.mock("@/lib/services/payment/subscription-auto-link", () => ({
  findActiveSubscriptionForApp: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/payment/sync-history-service", () => ({
  createSyncHistory: vi.fn().mockResolvedValue({ id: "sync-history-1" }),
  completeSyncHistory: vi.fn().mockResolvedValue({}),
  updateCardFailCount: vi.fn().mockResolvedValue({ consecutiveFailCount: 0 }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { getCachedSession } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { getCardApprovals } from "@/lib/services/hyphen";
import { matchMerchant4LayerSync } from "@/lib/services/payment/merchant-matcher";
import { findActiveSubscriptionForApp } from "@/lib/services/payment/subscription-auto-link";
import {
  completeSyncHistory,
  createSyncHistory,
  updateCardFailCount,
} from "@/lib/services/payment/sync-history-service";
import {
  checkNonSaaSCache,
  findNonSaaSKeywordHit,
  matchMerchantWithLLM,
  saveNonSaaSVendors,
} from "@/lib/services/saas-matcher";
import { syncCardTransactions } from "./card-sync";

// Test helper: build an ApprovalItem
function createApprovalItem(overrides: Record<string, string> = {}) {
  return {
    apprNo: "APPR001",
    useDt: "20250115",
    useTm: "143000",
    useStore: "AWS",
    useAmt: "10000",
    settleDt: "20250120",
    storeBizNo: "1234567890",
    storeType: "Software",
    storeAddr: "Business Bay, Dubai",
    useDiv: "Lump sum",
    instMon: null,
    addTax: "1000",
    ...overrides,
  };
}

const mockSession = {
  user: {
    id: "user-1",
    organizationId: "org-1",
    role: "ADMIN",
  },
};

const mockCard = {
  id: "card-1",
  organizationId: "org-1",
  cardCd: "SHINHAN",
  cardNo: "****1234",
  cardNm: "Corporate Card 1",
  cardLast4: "1234",
  encryptedCredentials: "encrypted",
  isActive: true,
  teamId: "team-1",
  assignedUserId: "user-1",
  lastSyncAt: null,
  lastError: null,
};

describe("syncCardTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCachedSession).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.corporateCard.findFirst).mockResolvedValue(
      mockCard as never
    );
    vi.mocked(prisma.corporateCard.update).mockResolvedValue({} as never);
    vi.mocked(prisma.app.findMany).mockResolvedValue([]);
    vi.mocked(prisma.saaSCatalog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.merchantPattern.findMany).mockResolvedValue([]);
    vi.mocked(prisma.cardTransaction.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.cardTransaction.create).mockResolvedValue({} as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
    vi.mocked(getCardApprovals).mockResolvedValue({
      data: { list: [] },
    } as never);
    vi.mocked(matchMerchant4LayerSync).mockReturnValue(null);
    vi.mocked(checkNonSaaSCache).mockResolvedValue(new Set());
    vi.mocked(findNonSaaSKeywordHit).mockReturnValue(null);
    vi.mocked(matchMerchantWithLLM).mockResolvedValue({
      appId: null,
      appName: null,
      confidence: 0,
      matchedBy: null,
      matchSource: "LLM",
    });
    vi.mocked(createSyncHistory).mockResolvedValue({
      id: "sync-history-1",
    } as never);
    vi.mocked(completeSyncHistory).mockResolvedValue({} as never);
    vi.mocked(updateCardFailCount).mockResolvedValue({
      consecutiveFailCount: 0,
    } as never);
  });

  describe("Authentication and card lookup", () => {
    it("returns an authentication error without a session", async () => {
      vi.mocked(getCachedSession).mockResolvedValue(null);

      const result = await syncCardTransactions("card-1");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Authentication required");
    });

    it("returns a card-not-found error when the card does not exist", async () => {
      vi.mocked(prisma.corporateCard.findFirst).mockResolvedValue(null);

      const result = await syncCardTransactions("card-999");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Card not found");
    });
  });

  describe("Phase 1: 4-layer matching", () => {
    it("adds to matched when catalog pattern matching finds an app", async () => {
      const awsItem = createApprovalItem({
        useStore: "AMAZON WEB SERVICES",
        apprNo: "APPR-AWS",
      });
      vi.mocked(getCardApprovals).mockResolvedValue({
        data: { list: [awsItem] },
      } as never);

      vi.mocked(prisma.app.findMany).mockResolvedValue([
        { id: "app-aws", name: "AWS", catalogId: "catalog-aws" },
      ] as never);

      vi.mocked(prisma.saaSCatalog.findMany).mockResolvedValue([
        {
          id: "catalog-aws",
          name: "AWS",
          slug: "aws",
          patterns: [
            {
              pattern: "amazon web services",
              matchType: "EXACT",
              confidence: 0.95,
            },
          ],
        },
      ] as never);

      // The 4-layer matcher returns a match
      vi.mocked(matchMerchant4LayerSync).mockReturnValue({
        appId: "app-aws",
        appName: "AWS",
        confidence: 0.95,
        matchSource: "CATALOG",
        matchLayer: 1,
        normalized: "amazon web services",
      });

      const result = await syncCardTransactions("card-1");

      expect(result.success).toBe(true);
      expect(result.data?.created).toBe(1);
      expect(matchMerchant4LayerSync).toHaveBeenCalledWith(
        { merchantName: "AMAZON WEB SERVICES", memo: "Lump sum" },
        expect.any(Array),
        expect.any(Array),
        0.8
      );
      // Verify matchSource was saved as CATALOG
      expect(prisma.cardTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          matchedAppId: "app-aws",
          matchSource: "CATALOG",
          matchStatus: "AUTO_MATCHED",
        }),
      });
    });

    it("adds to matched when fuzzy matching finds an app", async () => {
      const slackItem = createApprovalItem({
        useStore: "SLCK TECHNOLOGIES",
        apprNo: "APPR-SLACK",
      });
      vi.mocked(getCardApprovals).mockResolvedValue({
        data: { list: [slackItem] },
      } as never);

      vi.mocked(prisma.app.findMany).mockResolvedValue([
        { id: "app-slack", name: "Slack", catalogId: null },
      ] as never);

      vi.mocked(matchMerchant4LayerSync).mockReturnValue({
        appId: "app-slack",
        appName: "Slack",
        confidence: 0.85,
        matchSource: "CATALOG",
        matchLayer: 3,
        normalized: "slck technologies",
      });

      const result = await syncCardTransactions("card-1");

      expect(result.success).toBe(true);
      expect(result.data?.created).toBe(1);
      expect(matchMerchantWithLLM).not.toHaveBeenCalled();
    });

    it("applies custom patterns before the 4-layer matcher", async () => {
      const customItem = createApprovalItem({
        useStore: "INTERNAL-SVC-SLACK",
        apprNo: "APPR-CUSTOM",
      });
      vi.mocked(getCardApprovals).mockResolvedValue({
        data: { list: [customItem] },
      } as never);

      vi.mocked(prisma.merchantPattern.findMany).mockResolvedValue([
        { pattern: "internal-svc", appId: "app-internal" },
      ] as never);

      const result = await syncCardTransactions("card-1");

      expect(result.success).toBe(true);
      expect(result.data?.created).toBe(1);
      // The custom pattern matches first, so the 4-layer matcher must not be called
      expect(matchMerchant4LayerSync).not.toHaveBeenCalled();
      expect(prisma.cardTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          matchedAppId: "app-internal",
          matchSource: "PATTERN",
          matchConfidence: 1,
        }),
      });
    });

    it("classifies as unmatched when 4-layer matching fails", async () => {
      const unknownItem = createApprovalItem({
        useStore: "UNKNOWN VENDOR",
        apprNo: "APPR-UNK",
      });
      vi.mocked(getCardApprovals).mockResolvedValue({
        data: { list: [unknownItem] },
      } as never);

      vi.mocked(matchMerchant4LayerSync).mockReturnValue({
        appId: null,
        appName: null,
        confidence: 0,
        matchSource: null,
        matchLayer: null,
        normalized: "unknown vendor",
      });

      vi.mocked(matchMerchantWithLLM).mockResolvedValue({
        appId: null,
        appName: null,
        confidence: 0.2,
        matchedBy: null,
        matchSource: "LLM",
      });

      const result = await syncCardTransactions("card-1");

      expect(result.success).toBe(true);
      expect(matchMerchantWithLLM).toHaveBeenCalledTimes(1);
    });
  });

  describe("Phase 2: Non-SaaS filtering", () => {
    it("skips the LLM call when the merchant is in the Non-SaaS cache", async () => {
      const taxiItem = createApprovalItem({
        useStore: "Careem Taxi",
        apprNo: "APPR-TAXI",
      });
      vi.mocked(getCardApprovals).mockResolvedValue({
        data: { list: [taxiItem] },
      } as never);

      // 4-layer matching fails
      vi.mocked(matchMerchant4LayerSync).mockReturnValue({
        appId: null,
        appName: null,
        confidence: 0,
        matchSource: null,
        matchLayer: null,
        normalized: "careem taxi",
      });

      // Non-SaaS cache hit
      vi.mocked(checkNonSaaSCache).mockResolvedValue(new Set(["careem taxi"]));

      const result = await syncCardTransactions("card-1");

      expect(result.success).toBe(true);
      expect(matchMerchantWithLLM).not.toHaveBeenCalled();
      // Non-SaaS → saved with appId null, matchSource null, UNMATCHED
      expect(prisma.cardTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          matchedAppId: null,
          matchSource: null,
          matchStatus: "UNMATCHED",
        }),
      });
    });

    it("skips the LLM call and caches the vendor on a Non-SaaS keyword hit", async () => {
      const foodItem = createApprovalItem({
        useStore: "Talabat",
        apprNo: "APPR-FOOD",
      });
      vi.mocked(getCardApprovals).mockResolvedValue({
        data: { list: [foodItem] },
      } as never);

      vi.mocked(matchMerchant4LayerSync).mockReturnValue({
        appId: null,
        appName: null,
        confidence: 0,
        matchSource: null,
        matchLayer: null,
        normalized: "Talabat",
      });

      vi.mocked(findNonSaaSKeywordHit).mockReturnValue("Food/Delivery");

      const result = await syncCardTransactions("card-1");

      expect(result.success).toBe(true);
      expect(matchMerchantWithLLM).not.toHaveBeenCalled();
      expect(saveNonSaaSVendors).toHaveBeenCalledWith(
        "org-1",
        expect.arrayContaining([
          expect.objectContaining({
            originalName: "Talabat",
            reasoning: "Keyword excluded: Food/Delivery",
          }),
        ])
      );
    });

    it("saves matchStatus as UNMATCHED on a Non-SaaS keyword hit", async () => {
      const foodItem = createApprovalItem({
        useStore: "Talabat",
        apprNo: "APPR-FOOD2",
      });
      vi.mocked(getCardApprovals).mockResolvedValue({
        data: { list: [foodItem] },
      } as never);

      vi.mocked(matchMerchant4LayerSync).mockReturnValue({
        appId: null,
        appName: null,
        confidence: 0,
        matchSource: null,
        matchLayer: null,
        normalized: "Talabat",
      });

      vi.mocked(findNonSaaSKeywordHit).mockReturnValue("Food/Delivery");

      await syncCardTransactions("card-1");

      expect(prisma.cardTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          matchedAppId: null,
          matchStatus: "UNMATCHED",
        }),
      });
    });

    it("saves matchStatus as UNMATCHED on a Non-SaaS cache hit", async () => {
      const taxiItem = createApprovalItem({
        useStore: "Careem Taxi",
        apprNo: "APPR-TAXI2",
      });
      vi.mocked(getCardApprovals).mockResolvedValue({
        data: { list: [taxiItem] },
      } as never);

      vi.mocked(matchMerchant4LayerSync).mockReturnValue({
        appId: null,
        appName: null,
        confidence: 0,
        matchSource: null,
        matchLayer: null,
        normalized: "careem taxi",
      });

      vi.mocked(checkNonSaaSCache).mockResolvedValue(new Set(["careem taxi"]));

      await syncCardTransactions("card-1");

      expect(prisma.cardTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          matchedAppId: null,
          matchStatus: "UNMATCHED",
        }),
      });
    });
  });

  describe("Phase 3: individual LLM calls", () => {
    it("calls the LLM individually for each unmatched transaction", async () => {
      const item1 = createApprovalItem({
        useStore: "WASABI TECH",
        apprNo: "APPR-W1",
      });
      const item2 = createApprovalItem({
        useStore: "MAILGUN INC",
        apprNo: "APPR-M1",
      });
      vi.mocked(getCardApprovals).mockResolvedValue({
        data: { list: [item1, item2] },
      } as never);

      // 4-layer matching fails
      vi.mocked(matchMerchant4LayerSync).mockReturnValue({
        appId: null,
        appName: null,
        confidence: 0,
        matchSource: null,
        matchLayer: null,
        normalized: "",
      });

      vi.mocked(matchMerchantWithLLM)
        .mockResolvedValueOnce({
          appId: "app-wasabi",
          appName: "Wasabi",
          confidence: 0.9,
          matchedBy: "pattern",
          matchSource: "LLM",
        })
        .mockResolvedValueOnce({
          appId: "app-mailgun",
          appName: "Mailgun",
          confidence: 0.85,
          matchedBy: "pattern",
          matchSource: "LLM",
        });

      const result = await syncCardTransactions("card-1");

      expect(result.success).toBe(true);
      expect(result.data?.created).toBe(2);
      // Individual calls (one at a time, not batched)
      expect(matchMerchantWithLLM).toHaveBeenCalledTimes(2);
      expect(matchMerchantWithLLM).toHaveBeenCalledWith({
        organizationId: "org-1",
        merchantName: "WASABI TECH",
        memo: "Lump sum",
        storeBizNo: "1234567890",
        amount: 10000,
        currency: "KRW",
      });
      expect(matchMerchantWithLLM).toHaveBeenCalledWith({
        organizationId: "org-1",
        merchantName: "MAILGUN INC",
        memo: "Lump sum",
        storeBizNo: "1234567890",
        amount: 10000,
        currency: "KRW",
      });
    });

    it("saves matchStatus as UNMATCHED when the LLM finds no match", async () => {
      const unknownItem = createApprovalItem({
        useStore: "UNKNOWN VENDOR",
        apprNo: "APPR-UNK2",
      });
      vi.mocked(getCardApprovals).mockResolvedValue({
        data: { list: [unknownItem] },
      } as never);

      vi.mocked(matchMerchant4LayerSync).mockReturnValue({
        appId: null,
        appName: null,
        confidence: 0,
        matchSource: null,
        matchLayer: null,
        normalized: "unknown vendor",
      });

      vi.mocked(matchMerchantWithLLM).mockResolvedValue({
        appId: null,
        appName: null,
        confidence: 0.1,
        matchedBy: null,
        matchSource: "LLM",
      });

      await syncCardTransactions("card-1");

      expect(prisma.cardTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          matchedAppId: null,
          matchSource: "LLM",
          matchStatus: "UNMATCHED",
        }),
      });
    });

    it("saves LLM matches with matchSource=LLM", async () => {
      const openaiItem = createApprovalItem({
        useStore: "OPENAI LLC",
        apprNo: "APPR-OAI",
      });
      vi.mocked(getCardApprovals).mockResolvedValue({
        data: { list: [openaiItem] },
      } as never);

      vi.mocked(matchMerchant4LayerSync).mockReturnValue({
        appId: null,
        appName: null,
        confidence: 0,
        matchSource: null,
        matchLayer: null,
        normalized: "openai llc",
      });

      vi.mocked(matchMerchantWithLLM).mockResolvedValue({
        appId: "app-openai",
        appName: "OpenAI",
        confidence: 0.95,
        matchedBy: "pattern",
        matchSource: "LLM",
      });

      const result = await syncCardTransactions("card-1");

      expect(result.success).toBe(true);
      expect(prisma.cardTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          matchedAppId: "app-openai",
          matchSource: "LLM",
          matchConfidence: 0.95,
          matchStatus: "AUTO_MATCHED",
        }),
      });
    });
  });

  describe("Phase 4: persistence", () => {
    it("saves cancelled transactions without matching", async () => {
      const cancelItem = createApprovalItem({
        useStore: "AWS",
        apprNo: "APPR-CANCEL",
        useDiv: "승인취소", // Hyphen API value (cancelled approval); must stay Korean
      });
      vi.mocked(getCardApprovals).mockResolvedValue({
        data: { list: [cancelItem] },
      } as never);

      const result = await syncCardTransactions("card-1");

      expect(result.success).toBe(true);
      expect(result.data?.created).toBe(1);
      expect(matchMerchant4LayerSync).not.toHaveBeenCalled();
      expect(matchMerchantWithLLM).not.toHaveBeenCalled();
      expect(prisma.cardTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          matchedAppId: null,
          matchSource: null,
          matchStatus: "PENDING",
        }),
      });
    });

    it("keeps matchStatus for existing AUTO_MATCHED transactions", async () => {
      const awsItem = createApprovalItem({
        useStore: "AWS",
        apprNo: "APPR-EXISTING",
      });
      vi.mocked(getCardApprovals).mockResolvedValue({
        data: { list: [awsItem] },
      } as never);

      vi.mocked(matchMerchant4LayerSync).mockReturnValue({
        appId: "app-aws",
        appName: "AWS",
        confidence: 0.95,
        matchSource: "CATALOG",
        matchLayer: 1,
        normalized: "aws",
      });

      // Previously auto-matched record
      vi.mocked(prisma.cardTransaction.findUnique).mockResolvedValue({
        id: "tx-existing",
        matchStatus: "AUTO_MATCHED",
        matchedAppId: "app-aws-old",
      } as never);

      const result = await syncCardTransactions("card-1");

      expect(result.success).toBe(true);
      expect(result.data?.updated).toBe(1);
      expect(prisma.cardTransaction.update).toHaveBeenCalledWith({
        where: { id: "tx-existing" },
        data: expect.objectContaining({
          // Keeps AUTO_MATCHED status
          matchStatus: "AUTO_MATCHED",
          matchedAppId: "app-aws-old",
        }),
      });
    });

    it("creates an audit log on success", async () => {
      const item = createApprovalItem();
      vi.mocked(getCardApprovals).mockResolvedValue({
        data: { list: [item] },
      } as never);

      vi.mocked(matchMerchant4LayerSync).mockReturnValue({
        appId: "app-1",
        appName: "Test App",
        confidence: 0.9,
        matchSource: "CATALOG",
        matchLayer: 1,
        normalized: "aws",
      });

      await syncCardTransactions("card-1");

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "SYNC_CARD_TRANSACTIONS",
          entityType: "CorporateCard",
          entityId: "card-1",
          organizationId: "org-1",
        }),
      });
    });

    it("updates the card sync time", async () => {
      vi.mocked(getCardApprovals).mockResolvedValue({
        data: { list: [] },
      } as never);

      await syncCardTransactions("card-1");

      expect(prisma.corporateCard.update).toHaveBeenCalledWith({
        where: { id: "card-1" },
        data: expect.objectContaining({
          lastSyncAt: expect.any(Date),
          lastError: null,
        }),
      });
    });
  });

  describe("Mixed scenario", () => {
    it("routes multiple transactions down the correct paths", async () => {
      const awsItem = createApprovalItem({
        useStore: "AWS",
        apprNo: "APPR-1",
      });
      const taxiItem = createApprovalItem({
        useStore: "Careem Taxi",
        apprNo: "APPR-2",
      });
      const unknownItem = createApprovalItem({
        useStore: "MYSTERY SaaS",
        apprNo: "APPR-3",
      });
      const cancelItem = createApprovalItem({
        useStore: "AWS",
        apprNo: "APPR-4",
        useDiv: "승인취소", // Hyphen API value (cancelled approval); must stay Korean
      });

      vi.mocked(getCardApprovals).mockResolvedValue({
        data: { list: [awsItem, taxiItem, unknownItem, cancelItem] },
      } as never);

      // AWS → 4-layer match succeeds
      vi.mocked(matchMerchant4LayerSync)
        .mockReturnValueOnce({
          appId: "app-aws",
          appName: "AWS",
          confidence: 0.95,
          matchSource: "CATALOG",
          matchLayer: 1,
          normalized: "aws",
        })
        // Careem Taxi → 4-layer match fails
        .mockReturnValueOnce({
          appId: null,
          appName: null,
          confidence: 0,
          matchSource: null,
          matchLayer: null,
          normalized: "careem taxi",
        })
        // MYSTERY SaaS → 4-layer match fails
        .mockReturnValueOnce({
          appId: null,
          appName: null,
          confidence: 0,
          matchSource: null,
          matchLayer: null,
          normalized: "mystery saas",
        });

      // Careem Taxi → keyword filter
      vi.mocked(findNonSaaSKeywordHit)
        .mockReturnValueOnce("Taxi/Transport")
        .mockReturnValueOnce(null);

      // MYSTERY SaaS → LLM
      vi.mocked(matchMerchantWithLLM).mockResolvedValue({
        appId: "app-mystery",
        appName: "Mystery SaaS",
        confidence: 0.8,
        matchedBy: "pattern",
        matchSource: "LLM",
      });

      const result = await syncCardTransactions("card-1");

      expect(result.success).toBe(true);
      expect(result.data?.created).toBe(4);

      // 4-layer: AWS x1, keyword Non-SaaS skip: Careem x1, LLM: MYSTERY x1, cancelled: x1
      expect(matchMerchant4LayerSync).toHaveBeenCalledTimes(3);
      expect(matchMerchantWithLLM).toHaveBeenCalledTimes(1);
      expect(prisma.cardTransaction.create).toHaveBeenCalledTimes(4);
    });
  });

  describe("SMP-179: automatic subscription linking", () => {
    it("sets linkedSubscriptionId when the matched app has an ACTIVE subscription", async () => {
      const awsItem = createApprovalItem({
        useStore: "AWS",
        apprNo: "APPR-SUB-LINK",
      });
      vi.mocked(getCardApprovals).mockResolvedValue({
        data: { list: [awsItem] },
      } as never);

      vi.mocked(matchMerchant4LayerSync).mockReturnValue({
        appId: "app-aws",
        appName: "AWS",
        confidence: 0.95,
        matchSource: "CATALOG",
        matchLayer: 1,
        normalized: "aws",
      });

      vi.mocked(findActiveSubscriptionForApp).mockResolvedValue("sub-aws-1");

      const result = await syncCardTransactions("card-1");

      expect(result.success).toBe(true);
      expect(prisma.cardTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          matchedAppId: "app-aws",
          linkedSubscriptionId: "sub-aws-1",
        }),
      });
    });

    it("leaves linkedSubscriptionId null when the matched app has no subscription", async () => {
      const slackItem = createApprovalItem({
        useStore: "SLACK",
        apprNo: "APPR-NO-SUB",
      });
      vi.mocked(getCardApprovals).mockResolvedValue({
        data: { list: [slackItem] },
      } as never);

      vi.mocked(matchMerchant4LayerSync).mockReturnValue({
        appId: "app-slack",
        appName: "Slack",
        confidence: 0.9,
        matchSource: "CATALOG",
        matchLayer: 1,
        normalized: "slack",
      });

      vi.mocked(findActiveSubscriptionForApp).mockResolvedValue(null);

      const result = await syncCardTransactions("card-1");

      expect(result.success).toBe(true);
      expect(prisma.cardTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          matchedAppId: "app-slack",
          linkedSubscriptionId: null,
        }),
      });
    });

    it("preserves linkedSubscriptionId of existing AUTO_MATCHED records on resync", async () => {
      const awsItem = createApprovalItem({
        useStore: "AWS",
        apprNo: "APPR-RESYNC",
      });
      vi.mocked(getCardApprovals).mockResolvedValue({
        data: { list: [awsItem] },
      } as never);

      vi.mocked(matchMerchant4LayerSync).mockReturnValue({
        appId: "app-aws",
        appName: "AWS",
        confidence: 0.95,
        matchSource: "CATALOG",
        matchLayer: 1,
        normalized: "aws",
      });

      vi.mocked(findActiveSubscriptionForApp).mockResolvedValue("sub-aws-new");

      // The existing record is already AUTO_MATCHED
      vi.mocked(prisma.cardTransaction.findUnique).mockResolvedValue({
        id: "tx-existing",
        matchStatus: "AUTO_MATCHED",
        matchedAppId: "app-aws",
        linkedSubscriptionId: "sub-aws-old",
      } as never);

      const result = await syncCardTransactions("card-1");

      expect(result.success).toBe(true);
      expect(prisma.cardTransaction.update).toHaveBeenCalledWith({
        where: { id: "tx-existing" },
        data: expect.objectContaining({
          matchedAppId: "app-aws",
          linkedSubscriptionId: "sub-aws-old", // Existing value preserved
        }),
      });
    });
  });

  describe("Error handling", () => {
    it("records the error message and lastError when sync fails", async () => {
      // A DB error in the app lookup → propagates to the outer try-catch
      vi.mocked(prisma.app.findMany).mockRejectedValue(
        new Error("DB connection failed")
      );

      const result = await syncCardTransactions("card-1");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Failed to sync transactions");
      expect(prisma.corporateCard.update).toHaveBeenCalledWith({
        where: { id: "card-1" },
        data: expect.objectContaining({
          lastError: "DB connection failed",
        }),
      });
    });

    it("continues with empty results when fetching approvals fails", async () => {
      const { withRetry } = await import("@/lib/services/hyphen");
      vi.mocked(withRetry).mockRejectedValue(new Error("API call failed"));

      const result = await syncCardTransactions("card-1");

      // Approval failures are handled by the inner try-catch; the function succeeds
      expect(result.success).toBe(true);
      expect(result.data?.created).toBe(0);
      expect(result.data?.updated).toBe(0);
    });
  });

  describe("SyncHistory recording", () => {
    it("creates SyncHistory as RUNNING when sync starts", async () => {
      await syncCardTransactions("card-1");

      expect(createSyncHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          type: "CARD_SYNC",
          triggeredBy: "USER",
          userId: "user-1",
          corporateCardId: "card-1",
        })
      );
    });

    it("defaults to USER when no triggeredBy option is given", async () => {
      await syncCardTransactions("card-1");

      expect(createSyncHistory).toHaveBeenCalledWith(
        expect.objectContaining({ triggeredBy: "USER" })
      );
    });

    it("creates with CRON when triggeredBy CRON is passed", async () => {
      await syncCardTransactions("card-1", { triggeredBy: "CRON" });

      expect(createSyncHistory).toHaveBeenCalledWith(
        expect.objectContaining({ triggeredBy: "CRON" })
      );
    });

    it("calls completeSyncHistory with SUCCESS on success", async () => {
      await syncCardTransactions("card-1");

      expect(completeSyncHistory).toHaveBeenCalledWith(
        "sync-history-1",
        expect.objectContaining({ status: "SUCCESS" })
      );
    });

    it("calls updateCardFailCount with true on success", async () => {
      await syncCardTransactions("card-1");

      expect(updateCardFailCount).toHaveBeenCalledWith("card-1", true);
    });

    it("calls completeSyncHistory with FAILED on error", async () => {
      vi.mocked(prisma.app.findMany).mockRejectedValue(
        new Error("DB connection failed")
      );

      await syncCardTransactions("card-1");

      expect(completeSyncHistory).toHaveBeenCalledWith(
        "sync-history-1",
        expect.objectContaining({
          status: "FAILED",
          errorMessage: "DB connection failed",
        })
      );
    });

    it("calls updateCardFailCount with false on error", async () => {
      vi.mocked(prisma.app.findMany).mockRejectedValue(
        new Error("DB connection failed")
      );

      await syncCardTransactions("card-1");

      expect(updateCardFailCount).toHaveBeenCalledWith("card-1", false);
    });

    it("includes syncHistoryId in the success payload", async () => {
      const result = await syncCardTransactions("card-1");

      expect(result.success).toBe(true);
      expect(result.data?.syncHistoryId).toBe("sync-history-1");
    });

    it("continues the main sync when createSyncHistory fails", async () => {
      vi.mocked(createSyncHistory).mockRejectedValue(
        new Error("SyncHistory DB error")
      );

      const result = await syncCardTransactions("card-1");

      // The main sync succeeds even if SyncHistory fails
      expect(result.success).toBe(true);
    });
  });
});
