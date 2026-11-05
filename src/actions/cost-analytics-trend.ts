// src/actions/cost-analytics-trend.ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ActionState } from "@/types";
import type {
  GetMonthlyCostTrendResult,
  MonthlyCostTrend,
  UnmatchedPaymentSummary,
} from "@/types/cost-analytics";
import {
  applyCardTransactionScope,
  applyPaymentRecordScope,
  resolveReportScope,
} from "./cost-analytics-scope";
import {
  extractAmount,
  formatDisplayLabel,
  formatMonthKey,
} from "./cost-analytics-utils";

/**
 * Get the monthly cost trend
 */
export async function getMonthlyCostTrend(options: {
  months?: number;
  appIds?: string[];
  teamId?: string;
  userId?: string;
}): Promise<ActionState<GetMonthlyCostTrendResult>> {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, message: "Authentication required" };
    }

    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }

    const { months = 6, appIds, teamId, userId } = options;
    const scope = resolveReportScope({ teamId, userId }, session.user);

    // Calculate the period
    const now = new Date();
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - months + 1,
      1
    );

    // Fetch CardTransaction (only without an app filter, approvals only)
    // Include matchedAppId to classify SaaS/Non-SaaS
    let cardPayments: Array<{
      transactionDate: Date;
      amount: number;
      isSaas: boolean;
    }> = [];
    if (!appIds?.length) {
      const startStr = startDate.toISOString().slice(0, 10).replace(/-/g, "");
      const cardWhere: Record<string, unknown> = {
        organizationId: session.user.organizationId,
        transactionType: "APPROVAL", // based on approvals
        useDt: { gte: startStr },
      };
      applyCardTransactionScope(cardWhere, scope);

      const cardTransactions = await prisma.cardTransaction.findMany({
        where: cardWhere,
        select: {
          useDt: true,
          useAmt: true,
          matchedAppId: true, // for SaaS classification
        },
      });

      cardPayments = cardTransactions.map((tx) => ({
        transactionDate: new Date(
          parseInt(tx.useDt.substring(0, 4)),
          parseInt(tx.useDt.substring(4, 6)) - 1,
          parseInt(tx.useDt.substring(6, 8))
        ),
        amount: Number(tx.useAmt),
        isSaas: tx.matchedAppId !== null, // SaaS when matched to an app
      }));
    }

    // Fetch PaymentRecord (PENDING/UNMATCHED also count as Non-SaaS cost)
    // Include matchedAppId to classify SaaS/Non-SaaS
    const paymentWhere: Record<string, unknown> = {
      organizationId: session.user.organizationId,
      matchStatus: {
        in: ["MANUAL", "AUTO_MATCHED", "UNMATCHED", "PENDING"],
      },
      transactionDate: { gte: startDate },
      ...(appIds?.length ? { matchedAppId: { in: appIds } } : {}),
    };
    applyPaymentRecordScope(paymentWhere, scope);

    const csvPayments = await prisma.paymentRecord.findMany({
      where: paymentWhere,
      select: {
        transactionDate: true,
        amount: true,
        matchedAppId: true, // for SaaS classification
      },
    });

    // Combined payment list (with the isSaas flag)
    const payments = [
      ...cardPayments,
      ...csvPayments.map((p) => ({
        transactionDate: p.transactionDate,
        amount: extractAmount(p.amount),
        isSaas: p.matchedAppId !== null, // SaaS when matched to an app
      })),
    ];

    // Aggregate SaaS/Non-SaaS separately per month
    const monthlyData = new Map<
      string,
      {
        saasCost: number;
        nonSaasCost: number;
        saasCount: number;
        nonSaasCount: number;
      }
    >();

    // Initialize: create empty data for every month
    for (let i = 0; i < months; i++) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - months + 1 + i,
        1
      );
      const key = formatMonthKey(date);
      monthlyData.set(key, {
        saasCost: 0,
        nonSaasCost: 0,
        saasCount: 0,
        nonSaasCount: 0,
      });
    }

    // Aggregate data (SaaS/Non-SaaS separately)
    payments.forEach((payment) => {
      const key = formatMonthKey(payment.transactionDate);
      const existing = monthlyData.get(key);
      if (existing) {
        if (payment.isSaas) {
          existing.saasCost += payment.amount;
          existing.saasCount += 1;
        } else {
          existing.nonSaasCost += payment.amount;
          existing.nonSaasCount += 1;
        }
      }
    });

    // Convert results
    const trends: MonthlyCostTrend[] = [];
    let totalCost = 0;

    monthlyData.forEach((data, key) => {
      const monthTotalCost = data.saasCost + data.nonSaasCost;
      trends.push({
        month: key,
        displayLabel: formatDisplayLabel(key),
        totalCost: monthTotalCost,
        saasCost: data.saasCost,
        nonSaasCost: data.nonSaasCost,
        transactionCount: data.saasCount + data.nonSaasCount,
        saasTransactionCount: data.saasCount,
        nonSaasTransactionCount: data.nonSaasCount,
      });
      totalCost += monthTotalCost;
    });

    // Sort by date
    trends.sort((a, b) => a.month.localeCompare(b.month));

    const monthsWithData = trends.filter((t) => t.totalCost > 0).length;
    const averageCost =
      monthsWithData > 0 ? Math.round(totalCost / monthsWithData) : 0;

    return {
      success: true,
      data: { trends, averageCost },
    };
  } catch (error) {
    console.error("Monthly trend error:", error);
    return {
      success: false,
      message: "An error occurred while loading the monthly trend",
    };
  }
}

/**
 * Count unmatched payments (CardTransaction + PaymentRecord combined)
 */
export async function getUnmatchedPaymentCount(): Promise<
  ActionState<UnmatchedPaymentSummary>
> {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, message: "Authentication required" };
    }

    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }

    // Aggregate CardTransaction (no app-match field = all unmatched, approvals only)
    const cardResult = await prisma.cardTransaction.aggregate({
      where: {
        organizationId: session.user.organizationId,
        transactionType: "APPROVAL", // based on approvals
      },
      _count: { id: true },
      _sum: { useAmt: true },
    });

    // Aggregate unmatched PaymentRecord
    const csvResult = await prisma.paymentRecord.aggregate({
      where: {
        organizationId: session.user.organizationId,
        matchStatus: { in: ["PENDING", "UNMATCHED"] },
      },
      _count: { id: true },
      _sum: { amount: true },
    });

    // Fetch the most recent unmatched payment (both CardTransaction and PaymentRecord)
    const [latestCard, latestCsv] = await Promise.all([
      prisma.cardTransaction.findFirst({
        where: {
          organizationId: session.user.organizationId,
          transactionType: "APPROVAL", // based on approvals
        },
        orderBy: { useDt: "desc" },
        select: { useDt: true },
      }),
      prisma.paymentRecord.findFirst({
        where: {
          organizationId: session.user.organizationId,
          matchStatus: { in: ["PENDING", "UNMATCHED"] },
        },
        orderBy: { transactionDate: "desc" },
        select: { transactionDate: true },
      }),
    ]);

    // Compare the latest dates
    let latestDate: Date | null = null;
    if (latestCard?.useDt) {
      const cardDate = new Date(
        parseInt(latestCard.useDt.substring(0, 4)),
        parseInt(latestCard.useDt.substring(4, 6)) - 1,
        parseInt(latestCard.useDt.substring(6, 8))
      );
      latestDate = cardDate;
    }
    if (latestCsv?.transactionDate) {
      if (!latestDate || latestCsv.transactionDate > latestDate) {
        latestDate = latestCsv.transactionDate;
      }
    }

    const cardCount = cardResult._count.id || 0;
    const csvCount = csvResult._count.id || 0;
    const cardAmount = Number(cardResult._sum.useAmt || 0);
    const csvAmount = extractAmount(csvResult._sum.amount);

    return {
      success: true,
      data: {
        count: cardCount + csvCount,
        totalAmount: cardAmount + csvAmount,
        latestDate,
      },
    };
  } catch (error) {
    console.error("Unmatched payments error:", error);
    return {
      success: false,
      message: "An error occurred while loading unmatched payments",
    };
  }
}
