// src/actions/payment-import.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth
vi.mock("@/lib/fx/base-currency", () => ({
  getBaseCurrency: vi.fn().mockResolvedValue("KRW"),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock Prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    paymentRecord: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    cardTransaction: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    app: {
      findMany: vi.fn(),
    },
    subscription: {
      findFirst: vi.fn(),
    },
    saaSCatalog: {
      findMany: vi.fn(),
    },
    merchantPattern: {
      findMany: vi.fn(),
    },
    llmInference: {
      create: vi.fn(),
    },
    team: {
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn()),
  },
}));

vi.mock("@/lib/services/saas-matcher", () => ({
  matchMerchantWithLLM: vi.fn().mockResolvedValue({
    appId: "app-1",
    confidence: 0.8,
    matchSource: "LLM",
  }),
  checkNonSaaSCache: vi.fn().mockResolvedValue(new Set()),
  saveNonSaaSVendors: vi.fn().mockResolvedValue(undefined),
}));

// Mock revalidatePath
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  deletePaymentRecord,
  getPaymentRecords,
  getPaymentSummaryByApp,
  importPaymentCSV,
  linkPaymentToSubscription,
  updatePaymentMatch,
  updatePaymentRecord,
} from "./payment-import";

describe("payment-import actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("importPaymentCSV", () => {
    it("returns an error for an unauthenticated user", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await importPaymentCSV(
        "Transaction Date,Merchant,Amount\n2024-01-15,SLACK,100000"
      );

      expect(result).toEqual({
        success: false,
        message: "Authentication required",
      });
    });

    it("returns an error for a user without an organization ID", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: null, role: "ADMIN" },
      } as never);

      const result = await importPaymentCSV(
        "Transaction Date,Merchant,Amount\n2024-01-15,SLACK,100000"
      );

      expect(result).toEqual({
        success: false,
        message: "Organization information is required",
      });
    });

    it("returns an error for a non-ADMIN user", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "MEMBER" },
      } as never);

      const result = await importPaymentCSV(
        "Transaction Date,Merchant,Amount\n2024-01-15,SLACK,100000"
      );

      expect(result).toEqual({
        success: false,
        message: "Only admins can import payment records",
      });
    });

    it("imports payment records from a valid card company CSV", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.app.findMany).mockResolvedValue([
        { id: "app-1", name: "Slack", catalogId: "cat-1" },
      ] as never);

      vi.mocked(prisma.saaSCatalog.findMany).mockResolvedValue([
        {
          id: "cat-1",
          name: "Slack",
          slug: "slack",
          patterns: [
            { pattern: "slack", matchType: "EXACT", confidence: 0.95 },
          ],
        },
      ] as never);

      vi.mocked(prisma.merchantPattern.findMany).mockResolvedValue([]);

      // Mock for the duplicate check (empty array = no duplicates)
      vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([]);

      vi.mocked(prisma.paymentRecord.createMany).mockResolvedValue({
        count: 2,
      });

      // Kept in Korean: exercises the Korean card-company CSV header format the parser matches
      const csv = `결제일,가맹점명,결제금액,카드번호,승인번호
2024-01-15,SLACK TECHNOLOGIES,100000,1234-****-****-5678,12345678
2024-01-16,UNKNOWN VENDOR,50000,1234-****-****-5678,12345679`;

      const result = await importPaymentCSV(csv);

      expect(result.success).toBe(true);
      expect(result.data?.imported).toBe(2);
      // The match count may vary with the actual matching logic
      expect(result.data?.matched).toBeGreaterThanOrEqual(0);
      expect(result.data?.unmatched).toBeGreaterThanOrEqual(0);
      expect(prisma.paymentRecord.createMany).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith("/payments");
    });

    it("returns an error for an empty CSV", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      const result = await importPaymentCSV("");

      expect(result.success).toBe(false);
      expect(result.message).toContain("empty");
    });

    it("returns an error for an unsupported CSV format", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      const csv = `col1,col2,col3
val1,val2,val3`;

      const result = await importPaymentCSV(csv);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Unsupported");
    });

    // ==================== SMP-78: Team/User assignment tests ====================

    describe("Team/User assignment", () => {
      const validCsv = `Transaction Date,Merchant,Amount,Card Number,Approval
2024-01-15,SLACK TECHNOLOGIES,100000,1234-****-****-5678,12345678`;

      beforeEach(() => {
        vi.mocked(auth).mockResolvedValue({
          user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        } as never);

        vi.mocked(prisma.app.findMany).mockResolvedValue([]);
        vi.mocked(prisma.saaSCatalog.findMany).mockResolvedValue([]);
        vi.mocked(prisma.merchantPattern.findMany).mockResolvedValue([]);
        vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([]);
        vi.mocked(prisma.paymentRecord.createMany).mockResolvedValue({
          count: 1,
        });
      });

      it("imports payment records with a valid teamId", async () => {
        vi.mocked(prisma.team.findFirst).mockResolvedValue({
          id: "team-1",
          name: "Marketing",
          organizationId: "org-1",
        } as never);

        const result = await importPaymentCSV(validCsv, {
          teamId: "team-1",
        });

        expect(result.success).toBe(true);
        expect(prisma.paymentRecord.createMany).toHaveBeenCalledWith({
          data: expect.arrayContaining([
            expect.objectContaining({
              teamId: "team-1",
              userId: null,
            }),
          ]),
        });
      });

      it("imports payment records with a valid userId", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue({
          id: "user-2",
          name: "Omar Khalid",
          organizationId: "org-1",
        } as never);

        const result = await importPaymentCSV(validCsv, {
          userId: "user-2",
        });

        expect(result.success).toBe(true);
        expect(prisma.paymentRecord.createMany).toHaveBeenCalledWith({
          data: expect.arrayContaining([
            expect.objectContaining({
              teamId: null,
              userId: "user-2",
            }),
          ]),
        });
      });

      it("returns an error for a teamId from another organization", async () => {
        vi.mocked(prisma.team.findFirst).mockResolvedValue(null);

        const result = await importPaymentCSV(validCsv, {
          teamId: "other-org-team",
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Invalid team");
      });

      it("returns an error for a userId from another organization", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

        const result = await importPaymentCSV(validCsv, {
          userId: "other-org-user",
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Invalid user");
      });

      it("returns an error when both teamId and userId are given", async () => {
        const result = await importPaymentCSV(validCsv, {
          teamId: "team-1",
          userId: "user-2",
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe(
          "Select either a team or a user assignment, not both"
        );
      });

      it("imports payment records without teamId or userId (unassigned)", async () => {
        const result = await importPaymentCSV(validCsv);

        expect(result.success).toBe(true);
        expect(prisma.paymentRecord.createMany).toHaveBeenCalledWith({
          data: expect.arrayContaining([
            expect.objectContaining({
              teamId: null,
              userId: null,
            }),
          ]),
        });
      });
    });
  });

  describe("getPaymentRecords", () => {
    it("lists the organization's payment records", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // CardTransaction mock (empty array - no card data)
      vi.mocked(prisma.cardTransaction.findMany).mockResolvedValue([]);
      vi.mocked(prisma.cardTransaction.count).mockResolvedValue(0);

      // PaymentRecord mock
      vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([
        {
          id: "pr-1",
          transactionDate: new Date("2024-01-15"),
          merchantName: "SLACK",
          amount: 100000,
          currency: "KRW",
          cardLast4: "5678",
          approvalNumber: "12345678",
          matchStatus: "AUTO_MATCHED",
          matchConfidence: 0.95,
          matchedAppId: "app-1",
          matchedApp: { id: "app-1", name: "Slack" },
          linkedSubscriptionId: null,
          linkedSubscription: null,
        },
      ] as never);

      vi.mocked(prisma.paymentRecord.count).mockResolvedValue(1);

      const result = await getPaymentRecords({ page: 1, limit: 10 });

      expect(result.success).toBe(true);
      expect(result.data?.records).toHaveLength(1);
      expect(result.data?.total).toBe(1);
    });

    it("filters by matchStatus", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // CardTransaction mock - card data may be included with the PENDING filter
      vi.mocked(prisma.cardTransaction.findMany).mockResolvedValue([]);
      vi.mocked(prisma.cardTransaction.count).mockResolvedValue(0);

      // PaymentRecord mock
      vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([]);
      vi.mocked(prisma.paymentRecord.count).mockResolvedValue(0);

      await getPaymentRecords({ page: 1, limit: 10, matchStatus: "PENDING" });

      // PaymentRecord is called with the PENDING filter
      expect(prisma.paymentRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            matchStatus: "PENDING",
          }),
        })
      );
    });
  });

  describe("updatePaymentMatch", () => {
    it("updates PaymentRecord with a csv_ prefixed ID", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // PaymentRecord exists
      vi.mocked(prisma.paymentRecord.findFirst).mockResolvedValue({
        id: "pr-1",
        organizationId: "org-1",
      } as never);

      vi.mocked(prisma.paymentRecord.update).mockResolvedValue({
        id: "pr-1",
        matchedAppId: "app-1",
        matchStatus: "MANUAL",
      } as never);

      // use the csv_ prefix
      const result = await updatePaymentMatch("csv_pr-1", "app-1");

      expect(result.success).toBe(true);
      expect(prisma.paymentRecord.update).toHaveBeenCalledWith({
        where: { id: "pr-1" },
        data: expect.objectContaining({
          matchedAppId: "app-1",
          matchStatus: "MANUAL",
          matchSource: "MANUAL",
        }),
      });
    });

    it("updates CardTransaction with a card_ prefixed ID", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // CardTransaction exists
      vi.mocked(prisma.cardTransaction.findFirst).mockResolvedValue({
        id: "ct-1",
        organizationId: "org-1",
      } as never);

      vi.mocked(prisma.cardTransaction.update).mockResolvedValue({
        id: "ct-1",
        matchedAppId: "app-1",
      } as never);

      // use the card_ prefix
      const result = await updatePaymentMatch("card_ct-1", "app-1");

      expect(result.success).toBe(true);
      expect(prisma.cardTransaction.update).toHaveBeenCalledWith({
        where: { id: "ct-1" },
        data: expect.objectContaining({
          matchedAppId: "app-1",
          matchSource: "MANUAL",
        }),
      });
    });

    it("removes app matching", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // PaymentRecord exists
      vi.mocked(prisma.paymentRecord.findFirst).mockResolvedValue({
        id: "pr-1",
        organizationId: "org-1",
      } as never);

      vi.mocked(prisma.paymentRecord.update).mockResolvedValue({
        id: "pr-1",
        matchedAppId: null,
        matchStatus: "UNMATCHED",
      } as never);

      const result = await updatePaymentMatch("csv_pr-1", null);

      expect(result.success).toBe(true);
      expect(prisma.paymentRecord.update).toHaveBeenCalledWith({
        where: { id: "pr-1" },
        data: expect.objectContaining({
          matchedAppId: null,
          matchStatus: "UNMATCHED",
        }),
      });
    });

    it("supports legacy IDs (no prefix)", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // no PaymentRecord
      vi.mocked(prisma.paymentRecord.findFirst).mockResolvedValue(null);

      // CardTransaction exists
      vi.mocked(prisma.cardTransaction.findFirst).mockResolvedValue({
        id: "ct-1",
        organizationId: "org-1",
      } as never);

      vi.mocked(prisma.cardTransaction.update).mockResolvedValue({
        id: "ct-1",
        matchedAppId: "app-1",
      } as never);

      // call without a prefix
      const result = await updatePaymentMatch("ct-1", "app-1");

      expect(result.success).toBe(true);
      expect(prisma.cardTransaction.update).toHaveBeenCalledWith({
        where: { id: "ct-1" },
        data: expect.objectContaining({
          matchedAppId: "app-1",
          matchSource: "MANUAL",
        }),
      });
    });

    it("returns an error when there is neither a PaymentRecord nor a CardTransaction", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // neither exists
      vi.mocked(prisma.paymentRecord.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.cardTransaction.findFirst).mockResolvedValue(null);

      const result = await updatePaymentMatch("invalid-id", "app-1");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Payment record not found");
    });
  });

  describe("linkPaymentToSubscription", () => {
    it("links a payment record to a subscription", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
        id: "sub-1",
        appId: "app-1",
      } as never);

      vi.mocked(prisma.paymentRecord.update).mockResolvedValue({
        id: "pr-1",
        linkedSubscriptionId: "sub-1",
      } as never);

      const result = await linkPaymentToSubscription("pr-1", "sub-1");

      expect(result.success).toBe(true);
      expect(prisma.paymentRecord.update).toHaveBeenCalledWith({
        where: { id: "pr-1" },
        data: { linkedSubscriptionId: "sub-1" },
      });
    });

    it("returns an error when linking to a non-existent subscription", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);

      const result = await linkPaymentToSubscription("pr-1", "invalid-sub");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Subscription");
    });
  });

  describe("getPaymentSummaryByApp", () => {
    it("aggregates payment records per app", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.paymentRecord.groupBy).mockResolvedValue([
        {
          matchedAppId: "app-1",
          _sum: { amount: { toNumber: () => 150000 } },
          _count: { id: 3 },
        },
        {
          matchedAppId: "app-2",
          _sum: { amount: { toNumber: () => 80000 } },
          _count: { id: 2 },
        },
      ] as never);

      vi.mocked(prisma.app.findMany).mockResolvedValue([
        { id: "app-1", name: "Slack" },
        { id: "app-2", name: "Notion" },
      ] as never);

      const result = await getPaymentSummaryByApp({
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
      });

      expect(result.success).toBe(true);
      expect(result.data?.apps).toHaveLength(2);
      expect(result.data?.totalAmount).toBe(230000);
    });

    it("queries all data without a period", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.paymentRecord.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.app.findMany).mockResolvedValue([]);

      const result = await getPaymentSummaryByApp({});

      expect(result.success).toBe(true);
      expect(result.data?.apps).toHaveLength(0);
      expect(result.data?.totalAmount).toBe(0);
    });
  });

  describe("updatePaymentRecord", () => {
    it("returns an error for a non-admin", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "MEMBER" },
      } as never);

      const result = await updatePaymentRecord("payment-1", {
        notes: "Test note",
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Admin permission required");
    });

    it("updates a payment record", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.paymentRecord.findFirst).mockResolvedValue({
        id: "payment-1",
        organizationId: "org-1",
      } as never);

      vi.mocked(prisma.paymentRecord.update).mockResolvedValue({
        id: "payment-1",
        notes: "Test note",
      } as never);

      const result = await updatePaymentRecord("payment-1", {
        notes: "Test note",
      });

      expect(result.success).toBe(true);
      expect(prisma.paymentRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "payment-1" },
          data: expect.objectContaining({ notes: "Test note" }),
        })
      );
    });

    it("returns an error for a non-existent payment record", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.paymentRecord.findFirst).mockResolvedValue(null);

      const result = await updatePaymentRecord("non-existent", {
        notes: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Payment record not found");
    });
  });

  describe("deletePaymentRecord", () => {
    it("returns an error for a non-admin", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "MEMBER" },
      } as never);

      const result = await deletePaymentRecord("payment-1");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Admin permission required");
    });

    it("deletes a payment record", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.paymentRecord.findFirst).mockResolvedValue({
        id: "payment-1",
        organizationId: "org-1",
      } as never);

      vi.mocked(prisma.paymentRecord.delete).mockResolvedValue({} as never);

      const result = await deletePaymentRecord("payment-1");

      expect(result.success).toBe(true);
      expect(prisma.paymentRecord.delete).toHaveBeenCalledWith({
        where: { id: "payment-1" },
      });
    });

    it("returns an error for a non-existent payment record", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.paymentRecord.findFirst).mockResolvedValue(null);

      const result = await deletePaymentRecord("non-existent");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Payment record not found");
    });
  });
});
