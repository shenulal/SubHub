"use server";

import { getCachedSession } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { can } from "@/lib/rbac/service";
import { normalizeMerchantName } from "@/lib/services/payment/merchant-matcher";
import {
  checkNonSaaSCache,
  removeFromNonSaaSCache,
} from "@/lib/services/saas-matcher";
import type { ActionState } from "@/types";
import type { CardTransactionType } from "@prisma/client";
import { revalidatePath } from "next/cache";

// ==================== Transaction queries ====================

export type TransactionFilter = "saas" | "unmatched" | "non-saas" | "all";

export interface TransactionQuery {
  cardId?: string;
  startDate?: string;
  endDate?: string;
  matchStatus?: "matched" | "unmatched" | "all"; // deprecated, use filter
  filter?: TransactionFilter;
  page?: number;
  pageSize?: number;
}

export interface TransactionListResult {
  transactions: Array<{
    id: string;
    useDt: string;
    useTm: string | null;
    useStore: string;
    useAmt: number;
    transactionType: CardTransactionType;
    matchedApp: { id: string; name: string } | null;
    matchConfidence: number | null;
    corporateCard: { cardNm: string | null; cardLast4: string | null };
  }>;
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Fetch transactions
 * filter: saas | non-saas | unmatched | all
 */
export async function getCardTransactions(
  query: TransactionQuery
): Promise<TransactionListResult> {
  const session = await getCachedSession();
  if (!session?.user?.organizationId) {
    return { transactions: [], total: 0, page: 1, pageSize: 20 };
  }
  if (!(await can("payments:read"))) {
    return { transactions: [], total: 0, page: 1, pageSize: 20 };
  }

  const organizationId = session.user.organizationId;
  const page = query.page || 1;
  const pageSize = query.pageSize || 20;
  const filter = query.filter || "all";

  // Base where clause
  const baseWhere: {
    organizationId: string;
    corporateCardId?: string;
    useDt?: { gte?: string; lte?: string };
    matchedAppId?: { not: null } | null;
  } = {
    organizationId,
  };

  if (query.cardId) {
    baseWhere.corporateCardId = query.cardId;
  }

  if (query.startDate) {
    baseWhere.useDt = { ...baseWhere.useDt, gte: query.startDate };
  }

  if (query.endDate) {
    baseWhere.useDt = { ...baseWhere.useDt, lte: query.endDate };
  }

  // Legacy matchStatus support (deprecated)
  if (query.matchStatus === "matched") {
    baseWhere.matchedAppId = { not: null };
  } else if (query.matchStatus === "unmatched") {
    baseWhere.matchedAppId = null;
  }

  // Non-SaaS and Unmatched filters need special handling
  if (filter === "non-saas" || filter === "unmatched") {
    baseWhere.matchedAppId = null;

    const unmatchedTransactions = await prisma.cardTransaction.findMany({
      where: baseWhere,
      include: {
        matchedApp: { select: { id: true, name: true } },
        corporateCard: { select: { cardNm: true, cardLast4: true } },
      },
      orderBy: [{ useDt: "desc" }, { useTm: "desc" }],
    });

    const normalizedNames = unmatchedTransactions.map((t) =>
      normalizeMerchantName(t.useStore)
    );
    const nonSaaSSet = await checkNonSaaSCache(organizationId, normalizedNames);

    const filteredTransactions = unmatchedTransactions.filter((t) => {
      const normalized = normalizeMerchantName(t.useStore);
      const isNonSaaS = nonSaaSSet.has(normalized);
      return filter === "non-saas" ? isNonSaaS : !isNonSaaS;
    });

    const total = filteredTransactions.length;
    const paginatedTransactions = filteredTransactions.slice(
      (page - 1) * pageSize,
      page * pageSize
    );

    return {
      transactions: paginatedTransactions.map((t) => ({
        id: t.id,
        useDt: t.useDt,
        useTm: t.useTm,
        useStore: t.useStore,
        useAmt: Number(t.useAmt),
        transactionType: t.transactionType,
        matchedApp: t.matchedApp,
        matchConfidence: t.matchConfidence,
        corporateCard: t.corporateCard,
      })),
      total,
      page,
      pageSize,
    };
  }

  // SaaS filter
  if (filter === "saas") {
    baseWhere.matchedAppId = { not: null };
  }

  const [transactions, total] = await Promise.all([
    prisma.cardTransaction.findMany({
      where: baseWhere,
      include: {
        matchedApp: {
          select: { id: true, name: true },
        },
        corporateCard: {
          select: { cardNm: true, cardLast4: true },
        },
      },
      orderBy: [{ useDt: "desc" }, { useTm: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.cardTransaction.count({ where: baseWhere }),
  ]);

  return {
    transactions: transactions.map((t) => ({
      id: t.id,
      useDt: t.useDt,
      useTm: t.useTm,
      useStore: t.useStore,
      useAmt: Number(t.useAmt),
      transactionType: t.transactionType,
      matchedApp: t.matchedApp,
      matchConfidence: t.matchConfidence,
      corporateCard: t.corporateCard,
    })),
    total,
    page,
    pageSize,
  };
}

// ==================== Manual transaction-app matching ====================

/**
 * Manually match a transaction to an app
 */
async function _matchTransactionToAppManually(
  transactionId: string,
  appId: string | null
): Promise<ActionState> {
  try {
    const session = await getCachedSession();
    if (!session?.user?.organizationId) {
      return { success: false, message: "Authentication required" };
    }
    if (!(await can("payments:manage"))) {
      return {
        success: false,
        message: "You do not have permission to perform this action",
      };
    }

    const organizationId = session.user.organizationId;

    const transaction = await prisma.cardTransaction.findFirst({
      where: {
        id: transactionId,
        organizationId,
      },
    });

    if (!transaction) {
      return { success: false, message: "Transaction not found" };
    }

    if (appId) {
      const app = await prisma.app.findFirst({
        where: {
          id: appId,
          organizationId,
        },
      });

      if (!app) {
        return { success: false, message: "App not found" };
      }

      // When a user manually matches it as SaaS, remove it from the Non-SaaS cache
      const normalized = normalizeMerchantName(transaction.useStore);
      await removeFromNonSaaSCache(organizationId, normalized);
    }

    await prisma.cardTransaction.update({
      where: { id: transactionId },
      data: {
        matchedAppId: appId,
        matchConfidence: appId ? 1.0 : null,
        matchSource: appId ? "MANUAL" : null,
      },
    });

    revalidatePath("/transactions");

    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "Transaction matching failed");
    return { success: false, message: "Failed to match the transaction" };
  }
}
export const matchTransactionToAppManually = withLogging(
  "matchTransactionToAppManually",
  _matchTransactionToAppManually
);
