// src/lib/services/payment/unified-payment.test.ts
import type { PaymentMatchStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getUnifiedPayments,
  getUnifiedUnmatchedCount,
} from "./unified-payment";

// Prisma mock
vi.mock("@/lib/fx/base-currency", () => ({
  getBaseCurrency: vi.fn().mockResolvedValue("KRW"),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    cardTransaction: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    paymentRecord: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

describe("unified-payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUnifiedPayments", () => {
    it("should handle single matchStatus filter", async () => {
      const { prisma } = await import("@/lib/db");

      const result = await getUnifiedPayments({
        organizationId: "org-1",
        page: 1,
        limit: 10,
        matchStatus: "AUTO_MATCHED" as PaymentMatchStatus,
      });

      expect(prisma.paymentRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
            matchStatus: "AUTO_MATCHED",
          }),
        })
      );

      expect(result.records).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("should handle array matchStatus filter", async () => {
      const { prisma } = await import("@/lib/db");

      const result = await getUnifiedPayments({
        organizationId: "org-1",
        page: 1,
        limit: 10,
        matchStatus: ["AUTO_MATCHED", "MANUAL"] as PaymentMatchStatus[],
      });

      expect(prisma.paymentRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
            matchStatus: { in: ["AUTO_MATCHED", "MANUAL"] },
          }),
        })
      );

      expect(result.records).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("should handle PENDING matchStatus for card transactions", async () => {
      const { prisma } = await import("@/lib/db");

      await getUnifiedPayments({
        organizationId: "org-1",
        page: 1,
        limit: 10,
        matchStatus: "PENDING" as PaymentMatchStatus,
        source: "card",
      });

      // When PENDING is included, CardTransaction must also be queried
      expect(prisma.cardTransaction.findMany).toHaveBeenCalled();
    });

    // SMP-123: CardTransaction also supports the matchStatus field, so
    // with source: "card" every matchStatus filter can be queried
    it("should query card transactions with matchStatus filter (SMP-123)", async () => {
      const { prisma } = await import("@/lib/db");

      await getUnifiedPayments({
        organizationId: "org-1",
        page: 1,
        limit: 10,
        matchStatus: ["AUTO_MATCHED", "MANUAL"] as PaymentMatchStatus[],
        source: "card",
      });

      // CardTransaction supports matchStatus as well, so it must be queried
      expect(prisma.cardTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
            matchStatus: { in: ["AUTO_MATCHED", "MANUAL"] },
          }),
        })
      );
    });

    it("should handle unmatched filter (PENDING + UNMATCHED)", async () => {
      const { prisma } = await import("@/lib/db");

      const result = await getUnifiedPayments({
        organizationId: "org-1",
        page: 1,
        limit: 10,
        matchStatus: ["PENDING", "UNMATCHED"] as PaymentMatchStatus[],
      });

      expect(prisma.paymentRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
            matchStatus: { in: ["PENDING", "UNMATCHED"] },
          }),
        })
      );

      expect(result.records).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("should handle matched filter (AUTO_MATCHED + MANUAL)", async () => {
      const { prisma } = await import("@/lib/db");

      const result = await getUnifiedPayments({
        organizationId: "org-1",
        page: 1,
        limit: 10,
        matchStatus: ["AUTO_MATCHED", "MANUAL"] as PaymentMatchStatus[],
      });

      expect(prisma.paymentRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
            matchStatus: { in: ["AUTO_MATCHED", "MANUAL"] },
          }),
        })
      );

      expect(result.records).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe("getUnifiedUnmatchedCount", () => {
    it("should count only PENDING items (exclude UNMATCHED/Non-SaaS)", async () => {
      const { prisma } = await import("@/lib/db");

      vi.mocked(prisma.cardTransaction.count).mockResolvedValue(5);
      vi.mocked(prisma.paymentRecord.count).mockResolvedValue(3);

      const result = await getUnifiedUnmatchedCount("org-1");

      // CardTransaction: count PENDING only (UNMATCHED means already classified non-SaaS)
      expect(prisma.cardTransaction.count).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          transactionType: "APPROVAL",
          matchStatus: "PENDING",
        },
      });

      // PaymentRecord: count PENDING only
      expect(prisma.paymentRecord.count).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          matchStatus: "PENDING",
        },
      });

      expect(result).toEqual({
        cardCount: 5,
        csvCount: 3,
        total: 8,
      });
    });
  });
});
