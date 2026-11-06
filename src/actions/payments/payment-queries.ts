"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/service";
import type { ActionState } from "@/types";
import type { MatchSource, PaymentMatchStatus } from "@prisma/client";

export interface PaymentRecordWithApp {
  id: string;
  source: "card" | "csv";
  transactionDate: Date;
  merchantName: string;
  amount: number;
  currency: string;
  cardLast4: string | null;
  approvalNumber?: string | null;
  matchStatus: PaymentMatchStatus;
  matchConfidence: number | null;
  matchSource?: MatchSource | null;
  matchedApp: {
    id: string;
    name: string;
  } | null;
  linkedSubscription: {
    id: string;
    appName: string;
  } | null;
  cardTransactionId?: string | null;
  paymentRecordId?: string | null;
}

export interface GetPaymentRecordsResult {
  records: PaymentRecordWithApp[];
  total: number;
  page: number;
  totalPages: number;
}

export interface PaymentSummaryByAppResult {
  apps: Array<{
    appId: string;
    appName: string;
    totalAmount: number;
    transactionCount: number;
  }>;
  totalAmount: number;
  totalTransactions: number;
}

/**
 * Check whether payment data exists
 * hasData: true if either PaymentRecord or CardTransaction exists
 * Returns hasData: true by default on error to avoid false alarms
 */
export async function hasPaymentData(): Promise<
  ActionState<{ hasData: boolean }>
> {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, message: "Authentication required" };
    }
    if (!(await can("payments:read"))) {
      return {
        success: false,
        message: "You do not have permission to perform this action",
      };
    }

    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }

    const orgId = session.user.organizationId;

    const [paymentCount, cardCount] = await Promise.all([
      prisma.paymentRecord.count({ where: { organizationId: orgId } }),
      prisma.cardTransaction.count({ where: { organizationId: orgId } }),
    ]);

    return {
      success: true,
      data: { hasData: paymentCount > 0 || cardCount > 0 },
    };
  } catch (error) {
    console.error("Payment data existence check error:", error);
    return {
      success: true,
      data: { hasData: true },
    };
  }
}

/**
 * Get payment records (CardTransaction + PaymentRecord combined)
 */
export async function getPaymentRecords(options: {
  page: number;
  limit: number;
  matchStatus?: PaymentMatchStatus | PaymentMatchStatus[];
  appId?: string;
  startDate?: Date;
  endDate?: Date;
  source?: "card" | "csv" | "all";
}): Promise<ActionState<GetPaymentRecordsResult>> {
  try {
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        message: "Authentication required",
      };
    }
    if (!(await can("payments:read"))) {
      return {
        success: false,
        message: "You do not have permission to perform this action",
      };
    }

    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }

    const {
      page,
      limit,
      matchStatus,
      appId,
      startDate,
      endDate,
      source = "all",
    } = options;

    // Use the unified payment service
    const { getUnifiedPayments } =
      await import("@/lib/services/payment/unified-payment");

    const result = await getUnifiedPayments({
      organizationId: session.user.organizationId,
      page,
      limit,
      matchStatus,
      appId,
      startDate,
      endDate,
      source,
    });

    return {
      success: true,
      data: {
        records: result.records.map((r) => ({
          id: r.id,
          source: r.source,
          transactionDate: r.transactionDate,
          merchantName: r.merchantName,
          amount: r.amount,
          currency: r.currency,
          cardLast4: r.cardLast4,
          approvalNumber: r.approvalNumber,
          matchStatus: r.matchStatus,
          matchConfidence: r.matchConfidence,
          matchSource: r.matchSource,
          matchedApp: r.matchedApp,
          linkedSubscription: r.linkedSubscription,
          cardTransactionId: r.cardTransactionId,
          paymentRecordId: r.paymentRecordId,
        })),
        total: result.total,
        page,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  } catch (error) {
    console.error("Payment record query error:", error);
    return {
      success: false,
      message: "An error occurred while loading payment records",
    };
  }
}

/**
 * Aggregate payment records per app
 */
/**
 * Count by match status (for TabFilter)
 * Aggregates both PaymentRecord and CardTransaction
 */
export async function getPaymentStatusCounts(): Promise<
  ActionState<Record<PaymentMatchStatus | "all", number>>
> {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, message: "Authentication required" };
    }
    if (!(await can("payments:read"))) {
      return {
        success: false,
        message: "You do not have permission to perform this action",
      };
    }

    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }

    const orgId = session.user.organizationId;

    // PaymentRecord groupBy
    const csvCounts = await prisma.paymentRecord.groupBy({
      by: ["matchStatus"],
      where: { organizationId: orgId },
      _count: { id: true },
    });

    // CardTransaction groupBy
    const cardCounts = await prisma.cardTransaction.groupBy({
      by: ["matchStatus"],
      where: { organizationId: orgId },
      _count: { id: true },
    });

    // Sum
    const counts: Record<string, number> = {
      all: 0,
      PENDING: 0,
      AUTO_MATCHED: 0,
      MANUAL: 0,
      UNMATCHED: 0,
    };

    for (const row of csvCounts) {
      counts[row.matchStatus] = (counts[row.matchStatus] || 0) + row._count.id;
      counts.all += row._count.id;
    }

    for (const row of cardCounts) {
      counts[row.matchStatus] = (counts[row.matchStatus] || 0) + row._count.id;
      counts.all += row._count.id;
    }

    return {
      success: true,
      data: counts as Record<PaymentMatchStatus | "all", number>,
    };
  } catch (error) {
    console.error("Status count query error:", error);
    return {
      success: false,
      message: "An error occurred while loading status counts",
    };
  }
}

/**
 * Aggregate payment records per app
 */
export async function getPaymentSummaryByApp(options: {
  startDate?: Date;
  endDate?: Date;
}): Promise<ActionState<PaymentSummaryByAppResult>> {
  try {
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        message: "Authentication required",
      };
    }
    if (!(await can("payments:read"))) {
      return {
        success: false,
        message: "You do not have permission to perform this action",
      };
    }

    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }

    const { startDate, endDate } = options;

    // Build filter conditions
    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
      matchedAppId: { not: null },
      matchStatus: { in: ["MANUAL", "AUTO_MATCHED"] },
    };

    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) {
        (where.transactionDate as Record<string, Date>).gte = startDate;
      }
      if (endDate) {
        (where.transactionDate as Record<string, Date>).lte = endDate;
      }
    }

    // Aggregate per app
    const groupedPayments = await prisma.paymentRecord.groupBy({
      by: ["matchedAppId"],
      where,
      _sum: { amount: true },
      _count: { id: true },
    });

    // Fetch app info
    const appIds = groupedPayments
      .map((g) => g.matchedAppId)
      .filter((id): id is string => id !== null);

    const apps = await prisma.app.findMany({
      where: { id: { in: appIds } },
      select: { id: true, name: true },
    });

    const appMap = new Map(apps.map((app) => [app.id, app.name]));

    // Build the result
    let totalAmount = 0;
    let totalTransactions = 0;

    const appSummaries = groupedPayments
      .filter((g) => g.matchedAppId !== null)
      .map((g) => {
        const amount =
          typeof g._sum.amount === "object" && g._sum.amount !== null
            ? (g._sum.amount as { toNumber: () => number }).toNumber()
            : Number(g._sum.amount) || 0;
        const count = g._count.id || 0;

        totalAmount += amount;
        totalTransactions += count;

        return {
          appId: g.matchedAppId!,
          appName: appMap.get(g.matchedAppId!) || "Unknown",
          totalAmount: amount,
          transactionCount: count,
        };
      })
      .sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      success: true,
      data: {
        apps: appSummaries,
        totalAmount,
        totalTransactions,
      },
    };
  } catch (error) {
    console.error("Cost aggregation error:", error);
    return {
      success: false,
      message: "An error occurred while aggregating costs",
    };
  }
}
