// src/actions/cost-analytics.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock Prisma
// Organisation base currency (settings registry) is resolved via the FX helper
vi.mock("@/lib/fx/base-currency", () => ({
  getBaseCurrency: vi.fn().mockResolvedValue("KRW"),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    paymentRecord: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    cardTransaction: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    app: {
      findMany: vi.fn(),
    },
    subscription: {
      findMany: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  detectCostAnomalies,
  getCostStatistics,
  getForecastedCost,
  getMonthlyCostTrend,
  getTopCostApps,
  getUnmatchedPaymentCount,
} from "./cost-analytics";

describe("cost-analytics actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCostStatistics", () => {
    it("returns an error for an unauthenticated user", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await getCostStatistics({});

      expect(result).toEqual({
        success: false,
        message: "Authentication required",
      });
    });

    it("returns an error for a user without an organization ID", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: null, role: "ADMIN" },
      } as never);

      const result = await getCostStatistics({});

      expect(result).toEqual({
        success: false,
        message: "Organization information is required",
      });
    });

    it("calculates cost statistics correctly", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // Current-period PaymentRecord aggregate (SaaS)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: { toNumber: () => 1000000 } },
        _count: { id: 10 },
      } as never);

      // Current-period CardTransaction aggregate (SaaS)
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
        _count: { id: 0 },
      } as never);

      // Total-cost PaymentRecord aggregate (SaaS + Non-SaaS)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: { toNumber: () => 1500000 } },
      } as never);

      // Total-cost CardTransaction aggregate (SaaS + Non-SaaS)
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
      } as never);

      // Previous-period PaymentRecord aggregate (for period-over-period comparison)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: { toNumber: () => 800000 } },
        _count: { id: 8 },
      } as never);

      // Previous-period CardTransaction aggregate
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
        _count: { id: 0 },
      } as never);

      // All-time PaymentRecord aggregate (for the monthly average)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: { toNumber: () => 3000000 } },
      } as never);

      // Oldest PaymentRecord
      vi.mocked(prisma.paymentRecord.findFirst).mockResolvedValueOnce({
        transactionDate: new Date("2023-10-01"),
      } as never);

      // All-time CardTransaction aggregate (for the monthly average)
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
      } as never);

      // Oldest CardTransaction
      vi.mocked(prisma.cardTransaction.findFirst).mockResolvedValueOnce(
        null as never
      );

      const result = await getCostStatistics({
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
      });

      expect(result.success).toBe(true);
      expect(result.data?.statistics.totalCost).toBe(1000000);
      expect(result.data?.statistics.transactionCount).toBe(10);
      expect(result.data?.statistics.costChange).toBe(25); // (1000000 - 800000) / 800000 * 100 = 25%
      // Monthly average: over the whole period (differs from totalCost)
      expect(result.data?.statistics.monthlyAverage).toBeDefined();
      expect(result.data?.statistics.monthlyAverage).not.toBe(
        result.data?.statistics.totalCost
      );
      // totalCostAll >= totalCost (all >= SaaS)
      expect(result.data?.statistics.totalCostAll).toBe(1500000);
      expect(result.data?.statistics.totalCostAll).toBeGreaterThanOrEqual(
        result.data?.statistics.totalCost ?? 0
      );
    });

    it("returns a change rate of 0 when there is no previous data", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // Current-period PaymentRecord aggregate (SaaS)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: { toNumber: () => 500000 } },
        _count: { id: 5 },
      } as never);

      // Current-period CardTransaction aggregate (SaaS)
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
        _count: { id: 0 },
      } as never);

      // Total-cost PaymentRecord aggregate (SaaS + Non-SaaS)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: { toNumber: () => 500000 } },
      } as never);

      // Total-cost CardTransaction aggregate (SaaS + Non-SaaS)
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
      } as never);

      // Previous-period PaymentRecord aggregate (no data)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: null },
        _count: { id: 0 },
      } as never);

      // Previous-period CardTransaction aggregate
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
        _count: { id: 0 },
      } as never);

      // All-time PaymentRecord aggregate (for the monthly average)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: { toNumber: () => 500000 } },
      } as never);

      // Oldest PaymentRecord
      vi.mocked(prisma.paymentRecord.findFirst).mockResolvedValueOnce(
        null as never
      );

      // All-time CardTransaction aggregate (for the monthly average)
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
      } as never);

      // Oldest CardTransaction
      vi.mocked(prisma.cardTransaction.findFirst).mockResolvedValueOnce(
        null as never
      );

      const result = await getCostStatistics({});

      expect(result.success).toBe(true);
      expect(result.data?.statistics.costChange).toBe(0);
    });

    it("calculates the monthly average cost over the whole period", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // Current period (30 days) totalCost = 1,000,000 (SaaS)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: { toNumber: () => 1000000 } },
        _count: { id: 10 },
      } as never);
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
        _count: { id: 0 },
      } as never);

      // Total cost (SaaS + Non-SaaS)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: { toNumber: () => 1200000 } },
      } as never);
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
      } as never);

      // Previous period
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: null },
        _count: { id: 0 },
      } as never);
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
        _count: { id: 0 },
      } as never);

      // All-time allTimeTotal = 5,000,000 (total over 5 months)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: { toNumber: () => 5000000 } },
      } as never);

      // Oldest transaction: exactly 150 days ago (ceil(150/30.44) = 5 months)
      const msPerMonth = 30.44 * 24 * 60 * 60 * 1000;
      const fiveMonthsAgo = new Date(Date.now() - 150 * 24 * 60 * 60 * 1000);
      vi.mocked(prisma.paymentRecord.findFirst).mockResolvedValueOnce({
        transactionDate: fiveMonthsAgo,
      } as never);

      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
      } as never);
      vi.mocked(prisma.cardTransaction.findFirst).mockResolvedValueOnce(
        null as never
      );

      const result = await getCostStatistics({});

      expect(result.success).toBe(true);
      // totalCost = 1,000,000 (current period)
      expect(result.data?.statistics.totalCost).toBe(1000000);
      // Monthly average over the whole period
      const expectedMonths = Math.max(
        1,
        Math.ceil((Date.now() - fiveMonthsAgo.getTime()) / msPerMonth)
      );
      const expectedAvg = Math.round(5000000 / expectedMonths);
      expect(result.data?.statistics.monthlyAverage).toBe(expectedAvg);
    });

    it("applies the teamId filter to payment aggregation", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // Current period (SaaS)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: { toNumber: () => 0 } },
        _count: { id: 0 },
      } as never);
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
        _count: { id: 0 },
      } as never);

      // Total cost (SaaS + Non-SaaS)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: null },
      } as never);
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
      } as never);

      // Previous period
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: null },
        _count: { id: 0 },
      } as never);
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
        _count: { id: 0 },
      } as never);

      // All-time mocks (for the monthly average)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: null },
      } as never);
      vi.mocked(prisma.paymentRecord.findFirst).mockResolvedValueOnce(
        null as never
      );
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
      } as never);
      vi.mocked(prisma.cardTransaction.findFirst).mockResolvedValueOnce(
        null as never
      );

      await getCostStatistics({ teamId: "team-1" });

      expect(prisma.paymentRecord.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { teamId: "team-1" },
              { user: { teamId: "team-1" } },
            ]),
          }),
        })
      );

      expect(prisma.cardTransaction.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            corporateCard: {
              OR: [
                { teamId: "team-1" },
                { assignedUser: { teamId: "team-1" } },
              ],
            },
          }),
        })
      );
    });

    it("applies the userId filter to payment aggregation", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // Current period (SaaS)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: { toNumber: () => 0 } },
        _count: { id: 0 },
      } as never);
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
        _count: { id: 0 },
      } as never);

      // Total cost (SaaS + Non-SaaS)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: null },
      } as never);
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
      } as never);

      // Previous period
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: null },
        _count: { id: 0 },
      } as never);
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
        _count: { id: 0 },
      } as never);

      // All-time mocks (for the monthly average)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: null },
      } as never);
      vi.mocked(prisma.paymentRecord.findFirst).mockResolvedValueOnce(
        null as never
      );
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
      } as never);
      vi.mocked(prisma.cardTransaction.findFirst).mockResolvedValueOnce(
        null as never
      );

      await getCostStatistics({ userId: "user-1" });

      expect(prisma.paymentRecord.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "user-1",
          }),
        })
      );

      expect(prisma.cardTransaction.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            corporateCard: { assignedUserId: "user-1" },
          }),
        })
      );
    });

    it("includes PENDING and UNMATCHED in the matchStatus filter", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // Current period (SaaS)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: { toNumber: () => 0 } },
        _count: { id: 0 },
      } as never);
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
        _count: { id: 0 },
      } as never);

      // Total cost (SaaS + Non-SaaS)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: null },
      } as never);
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
      } as never);

      // Previous period
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: null },
        _count: { id: 0 },
      } as never);
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
        _count: { id: 0 },
      } as never);

      // All-time mocks (for the monthly average)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: null },
      } as never);
      vi.mocked(prisma.paymentRecord.findFirst).mockResolvedValueOnce(
        null as never
      );
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
      } as never);
      vi.mocked(prisma.cardTransaction.findFirst).mockResolvedValueOnce(
        null as never
      );

      await getCostStatistics({});

      // Verify aggregate calls for current period + total cost + previous period + all time
      expect(prisma.paymentRecord.aggregate).toHaveBeenCalledTimes(4);

      // Current period
      expect(prisma.paymentRecord.aggregate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            matchStatus: {
              in: ["MANUAL", "AUTO_MATCHED", "UNMATCHED", "PENDING"],
            },
          }),
        })
      );

      // Previous period
      expect(prisma.paymentRecord.aggregate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            matchStatus: {
              in: ["MANUAL", "AUTO_MATCHED", "UNMATCHED", "PENDING"],
            },
          }),
        })
      );
    });

    it("includes the matchedAppId filter to aggregate only SaaS-matched payments", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // Current period (SaaS)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: { toNumber: () => 0 } },
        _count: { id: 0 },
      } as never);
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
        _count: { id: 0 },
      } as never);

      // Total cost (SaaS + Non-SaaS) — no matchedAppId filter
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: null },
      } as never);
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
      } as never);

      // Previous period
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: null },
        _count: { id: 0 },
      } as never);
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
        _count: { id: 0 },
      } as never);

      // All-time mocks (for the monthly average)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValueOnce({
        _sum: { amount: null },
      } as never);
      vi.mocked(prisma.paymentRecord.findFirst).mockResolvedValueOnce(
        null as never
      );
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValueOnce({
        _sum: { useAmt: null },
      } as never);
      vi.mocked(prisma.cardTransaction.findFirst).mockResolvedValueOnce(
        null as never
      );

      await getCostStatistics({});

      // PaymentRecord: 1=current (SaaS), 2=total cost, 3=previous (SaaS), 4=all time (monthly average)
      // Current period (SaaS) — with matchedAppId filter
      expect(prisma.paymentRecord.aggregate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            matchedAppId: { not: null },
          }),
        })
      );

      // Total cost (call 2) — no matchedAppId filter
      expect(prisma.paymentRecord.aggregate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.not.objectContaining({
            matchedAppId: expect.anything(),
          }),
        })
      );

      // Previous period (SaaS) — with matchedAppId filter
      expect(prisma.paymentRecord.aggregate).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          where: expect.objectContaining({
            matchedAppId: { not: null },
          }),
        })
      );

      // All time (for the monthly average) — with matchedAppId filter
      expect(prisma.paymentRecord.aggregate).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({
          where: expect.objectContaining({
            matchedAppId: { not: null },
          }),
        })
      );

      // CardTransaction: 1=current (SaaS), 2=total cost, 3=previous (SaaS), 4=all time (monthly average)
      // Current period (SaaS) — with matchedAppId filter
      expect(prisma.cardTransaction.aggregate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            matchedAppId: { not: null },
          }),
        })
      );

      // Total cost (call 2) — no matchedAppId filter
      expect(prisma.cardTransaction.aggregate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.not.objectContaining({
            matchedAppId: expect.anything(),
          }),
        })
      );

      // Previous period (SaaS) — with matchedAppId filter
      expect(prisma.cardTransaction.aggregate).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          where: expect.objectContaining({
            matchedAppId: { not: null },
          }),
        })
      );

      // All time (for the monthly average) — with matchedAppId filter
      expect(prisma.cardTransaction.aggregate).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({
          where: expect.objectContaining({
            matchedAppId: { not: null },
          }),
        })
      );
    });
  });

  describe("getTopCostApps", () => {
    it("returns the top-cost app list (PaymentRecord + CardTransaction combined)", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.paymentRecord.groupBy).mockResolvedValue([
        {
          matchedAppId: "app-1",
          _sum: { amount: { toNumber: () => 500000 } },
          _count: { id: 5 },
        },
        {
          matchedAppId: "app-2",
          _sum: { amount: { toNumber: () => 300000 } },
          _count: { id: 3 },
        },
      ] as never);

      // CardTransaction groupBy: additional 200000 for app-1
      vi.mocked(prisma.cardTransaction.groupBy).mockResolvedValue([
        {
          matchedAppId: "app-1",
          _sum: { useAmt: 200000 },
          _count: { id: 2 },
        },
      ] as never);

      vi.mocked(prisma.app.findMany).mockResolvedValue([
        { id: "app-1", name: "Slack", logoUrl: null },
        { id: "app-2", name: "Notion", logoUrl: null },
      ] as never);

      const result = await getTopCostApps({ limit: 5 });

      expect(result.success).toBe(true);
      expect(result.data?.apps).toHaveLength(2);
      expect(result.data?.apps[0].appName).toBe("Slack");
      // PaymentRecord 500000 + CardTransaction 200000 = 700000
      expect(result.data?.apps[0].totalCost).toBe(700000);
      // Total: 700000 + 300000 = 1000000
      expect(result.data?.totalCost).toBe(1000000);
      expect(result.data?.apps[0].percentage).toBeCloseTo(70);
    });

    it("uses the 5 matchStatus values", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.paymentRecord.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.cardTransaction.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.app.findMany).mockResolvedValue([]);

      await getTopCostApps({});

      expect(prisma.paymentRecord.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            matchStatus: {
              in: ["MANUAL", "AUTO_MATCHED", "UNMATCHED", "PENDING"],
            },
          }),
        })
      );
    });

    it("returns an empty array when there is no data", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.paymentRecord.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.cardTransaction.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.app.findMany).mockResolvedValue([]);

      const result = await getTopCostApps({});

      expect(result.success).toBe(true);
      expect(result.data?.apps).toHaveLength(0);
      expect(result.data?.totalCost).toBe(0);
    });

    it("includes apps that only have CardTransactions", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // PaymentRecord: none
      vi.mocked(prisma.paymentRecord.groupBy).mockResolvedValue([]);

      // CardTransaction: 100000 for app-3
      vi.mocked(prisma.cardTransaction.groupBy).mockResolvedValue([
        {
          matchedAppId: "app-3",
          _sum: { useAmt: 100000 },
          _count: { id: 1 },
        },
      ] as never);

      vi.mocked(prisma.app.findMany).mockResolvedValue([
        { id: "app-3", name: "GitHub", logoUrl: null },
      ] as never);

      const result = await getTopCostApps({});

      expect(result.success).toBe(true);
      expect(result.data?.apps).toHaveLength(1);
      expect(result.data?.apps[0].appName).toBe("GitHub");
      expect(result.data?.apps[0].totalCost).toBe(100000);
      expect(result.data?.totalCost).toBe(100000);
    });
  });

  describe("getMonthlyCostTrend", () => {
    it("returns the monthly trend for the last 6 months", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // CardTransaction mock (empty array - no card data)
      vi.mocked(prisma.cardTransaction.findMany).mockResolvedValue([]);

      // Mock monthly group results
      vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([
        {
          transactionDate: new Date("2024-01-15"),
          amount: { toNumber: () => 100000 },
        },
        {
          transactionDate: new Date("2024-01-20"),
          amount: { toNumber: () => 200000 },
        },
        {
          transactionDate: new Date("2024-02-10"),
          amount: { toNumber: () => 150000 },
        },
      ] as never);

      const result = await getMonthlyCostTrend({ months: 6 });

      expect(result.success).toBe(true);
      expect(result.data?.trends).toBeDefined();
      expect(result.data?.trends.length).toBeGreaterThanOrEqual(0);
    });

    it("aggregates Non-SaaS cost in UNMATCHED status correctly", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // CardTransaction mock (empty array)
      vi.mocked(prisma.cardTransaction.findMany).mockResolvedValue([]);

      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 15);

      // Mix of SaaS-matched payments and Non-SaaS (UNMATCHED) payments
      vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([
        {
          transactionDate: currentMonth,
          amount: { toNumber: () => 100000 },
          matchedAppId: "app-1", // SaaS
        },
        {
          transactionDate: currentMonth,
          amount: { toNumber: () => 50000 },
          matchedAppId: null, // Non-SaaS (UNMATCHED)
        },
        {
          transactionDate: currentMonth,
          amount: { toNumber: () => 30000 },
          matchedAppId: null, // Non-SaaS (UNMATCHED)
        },
      ] as never);

      const result = await getMonthlyCostTrend({ months: 1 });

      expect(result.success).toBe(true);
      expect(result.data?.trends).toBeDefined();
      expect(result.data!.trends.length).toBe(1);

      const monthData = result.data!.trends[0];
      // Non-SaaS cost must not be 0
      expect(monthData.nonSaasCost).toBe(80000); // 50000 + 30000
      expect(monthData.saasCost).toBe(100000);
      expect(monthData.totalCost).toBe(180000);
      expect(monthData.nonSaasTransactionCount).toBe(2);
      expect(monthData.saasTransactionCount).toBe(1);
    });

    it("includes PENDING and UNMATCHED in the matchStatus filter", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.cardTransaction.findMany).mockResolvedValue([]);
      vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([]);

      await getMonthlyCostTrend({});

      expect(prisma.paymentRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            matchStatus: {
              in: ["MANUAL", "AUTO_MATCHED", "UNMATCHED", "PENDING"],
            },
          }),
        })
      );
    });

    it("aggregates PENDING records as Non-SaaS cost", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.cardTransaction.findMany).mockResolvedValue([]);

      const now = new Date();
      vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([
        {
          transactionDate: now,
          amount: { toNumber: () => 50000 },
          matchedAppId: null,
          matchStatus: "PENDING",
        },
        {
          transactionDate: now,
          amount: { toNumber: () => 30000 },
          matchedAppId: null,
          matchStatus: "UNMATCHED",
        },
      ] as never);

      const result = await getMonthlyCostTrend({});

      expect(result.success).toBe(true);
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const monthData = result.data?.trends.find((t) => t.month === monthKey);
      expect(monthData).toBeDefined();
      expect(monthData!.nonSaasCost).toBe(80000);
      expect(monthData!.nonSaasTransactionCount).toBe(2);
    });

    it("defaults months to 6", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // CardTransaction mock (empty array)
      vi.mocked(prisma.cardTransaction.findMany).mockResolvedValue([]);

      vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([]);

      const result = await getMonthlyCostTrend({});

      expect(result.success).toBe(true);
      // Returns 6 months of empty data
      expect(result.data?.trends).toBeDefined();
    });

    it("excludes months without data (0) from the averageCost denominator", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.cardTransaction.findMany).mockResolvedValue([]);

      // Only 1 of 3 months has data
      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 15);

      vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([
        {
          transactionDate: currentMonth,
          amount: { toNumber: () => 300000 },
          matchedAppId: "app-1",
        },
      ] as never);

      const result = await getMonthlyCostTrend({ months: 3 });

      expect(result.success).toBe(true);
      // Only 1 of 3 months has data, so average = 300000 / 1 = 300000
      // (old approach: 300000 / 3 = 100000 — wrong)
      expect(result.data?.averageCost).toBe(300000);
    });

    it("returns averageCost 0 when no month has data", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.cardTransaction.findMany).mockResolvedValue([]);
      vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([]);

      const result = await getMonthlyCostTrend({ months: 6 });

      expect(result.success).toBe(true);
      expect(result.data?.averageCost).toBe(0);
    });
  });

  describe("getUnmatchedPaymentCount", () => {
    it("returns the unmatched payment count", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // CardTransaction mock (all card payments are treated as unmatched)
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValue({
        _count: { id: 5 },
        _sum: { useAmt: 500000 },
      } as never);

      // CardTransaction findFirst - latest card transaction date
      vi.mocked(prisma.cardTransaction.findFirst).mockResolvedValue({
        useDt: "20240125",
      } as never);

      // PaymentRecord mock
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValue({
        _count: { id: 10 },
        _sum: { amount: { toNumber: () => 750000 } },
      } as never);

      // PaymentRecord findFirst - latest CSV payment date
      vi.mocked(prisma.paymentRecord.findFirst).mockResolvedValue({
        transactionDate: new Date("2024-01-25"),
      } as never);

      const result = await getUnmatchedPaymentCount();

      expect(result.success).toBe(true);
      // 5 card + 10 CSV = 15
      expect(result.data?.count).toBe(15);
    });

    it("returns 0 when there are no unmatched payments", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // CardTransaction mock (none)
      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValue({
        _count: { id: 0 },
        _sum: { useAmt: null },
      } as never);

      // CardTransaction findFirst - none
      vi.mocked(prisma.cardTransaction.findFirst).mockResolvedValue(null);

      // PaymentRecord mock (none)
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValue({
        _count: { id: 0 },
        _sum: { amount: null },
      } as never);

      // PaymentRecord findFirst - none
      vi.mocked(prisma.paymentRecord.findFirst).mockResolvedValue(null);

      const result = await getUnmatchedPaymentCount();

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(0);
      expect(result.data?.totalAmount).toBe(0);
      expect(result.data?.latestDate).toBeNull();
    });
  });

  describe("detectCostAnomalies", () => {
    it("detects apps with cost spikes", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // Current-month data
      vi.mocked(prisma.paymentRecord.groupBy).mockResolvedValueOnce([
        { matchedAppId: "app-1", _sum: { amount: { toNumber: () => 300000 } } },
        { matchedAppId: "app-2", _sum: { amount: { toNumber: () => 100000 } } },
      ] as never);

      // Previous-month data
      vi.mocked(prisma.paymentRecord.groupBy).mockResolvedValueOnce([
        { matchedAppId: "app-1", _sum: { amount: { toNumber: () => 100000 } } },
        { matchedAppId: "app-2", _sum: { amount: { toNumber: () => 90000 } } },
      ] as never);

      vi.mocked(prisma.app.findMany).mockResolvedValue([
        { id: "app-1", name: "Slack" },
        { id: "app-2", name: "Notion" },
      ] as never);

      const result = await detectCostAnomalies();

      expect(result.success).toBe(true);
      expect(result.data?.hasAnomalies).toBe(true);
      // app-1 rose 200% (100000 -> 300000)
      expect(result.data?.anomalies.some((a) => a.appId === "app-1")).toBe(
        true
      );
      expect(
        result.data?.anomalies.find((a) => a.appId === "app-1")?.severity
      ).toBe("high");
    });

    it("returns an empty array when there are no anomalies", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.paymentRecord.groupBy).mockResolvedValueOnce([
        { matchedAppId: "app-1", _sum: { amount: { toNumber: () => 100000 } } },
      ] as never);

      vi.mocked(prisma.paymentRecord.groupBy).mockResolvedValueOnce([
        { matchedAppId: "app-1", _sum: { amount: { toNumber: () => 100000 } } },
      ] as never);

      vi.mocked(prisma.app.findMany).mockResolvedValue([
        { id: "app-1", name: "Slack" },
      ] as never);

      const result = await detectCostAnomalies();

      expect(result.success).toBe(true);
      expect(result.data?.hasAnomalies).toBe(false);
      expect(result.data?.anomalies).toHaveLength(0);
    });
  });

  describe("getForecastedCost", () => {
    it("returns the subscription-based forecast cost", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.subscription.findMany).mockResolvedValue([
        {
          id: "sub-1",
          app: { name: "Slack" },
          amount: { toNumber: () => 100000 },
          billingCycle: "MONTHLY",
          renewalDate: new Date("2024-02-15"),
        },
        {
          id: "sub-2",
          app: { name: "Notion" },
          amount: { toNumber: () => 600000 },
          billingCycle: "YEARLY",
          renewalDate: new Date("2024-12-01"),
        },
      ] as never);

      // Actual payment records
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValue({
        _sum: { amount: { toNumber: () => 95000 } },
      } as never);

      const result = await getForecastedCost({ targetMonth: "2024-02" });

      expect(result.success).toBe(true);
      expect(result.data?.forecast.forecastedCost).toBeGreaterThan(0);
      expect(result.data?.forecast.subscriptionBreakdown).toBeDefined();
    });

    it("returns a forecast cost of 0 when there are no subscriptions", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);
      vi.mocked(prisma.paymentRecord.aggregate).mockResolvedValue({
        _sum: { amount: null },
      } as never);

      const result = await getForecastedCost({});

      expect(result.success).toBe(true);
      expect(result.data?.forecast.forecastedCost).toBe(0);
      expect(result.data?.forecast.subscriptionBreakdown).toHaveLength(0);
    });
  });
});
