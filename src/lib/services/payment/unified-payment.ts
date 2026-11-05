// src/lib/services/payment/unified-payment.ts
import { prisma } from "@/lib/db";
import { getBaseCurrency } from "@/lib/fx/base-currency";
import { DEFAULT_BASE_CURRENCY } from "@/lib/fx/convert";
import type { MatchSource, PaymentMatchStatus, Prisma } from "@prisma/client";

// Unified payment interface
export interface UnifiedPayment {
  id: string;
  source: "card" | "csv";
  transactionDate: Date;
  merchantName: string;
  amount: number;
  currency: string;
  approvalNumber: string | null;
  cardLast4: string | null;

  // App matching (default for CardTransaction)
  matchedAppId: string | null;
  matchedApp: { id: string; name: string } | null;
  matchConfidence: number | null;
  matchStatus: PaymentMatchStatus;
  matchSource: MatchSource | null;

  // Subscription link (null for CardTransaction)
  linkedSubscriptionId: string | null;
  linkedSubscription: { id: string; appName: string } | null;

  // Source ID (needed for edit/delete)
  cardTransactionId: string | null;
  paymentRecordId: string | null;
}

// Query options
export interface UnifiedPaymentOptions {
  organizationId: string;
  page?: number;
  limit?: number;
  matchStatus?: PaymentMatchStatus | PaymentMatchStatus[];
  appId?: string;
  startDate?: Date;
  endDate?: Date;
  source?: "card" | "csv" | "all";
}

// CardTransaction type (Prisma include result)
type CardTransactionWithRelations = Prisma.CardTransactionGetPayload<{
  include: {
    corporateCard: true;
    matchedApp: true;
    linkedSubscription: {
      include: { app: true };
    };
  };
}>;

// PaymentRecord type (Prisma include result)
type PaymentRecordWithRelations = Prisma.PaymentRecordGetPayload<{
  include: {
    matchedApp: true;
    linkedSubscription: {
      include: { app: true };
    };
  };
}>;

/**
 * Converts useDt (YYYYMMDD) + useTm (HHmmss) → Date
 */
function parseCardTransactionDate(useDt: string, useTm?: string | null): Date {
  const year = parseInt(useDt.substring(0, 4), 10);
  const month = parseInt(useDt.substring(4, 6), 10) - 1;
  const day = parseInt(useDt.substring(6, 8), 10);

  if (useTm && useTm.length >= 6) {
    const hour = parseInt(useTm.substring(0, 2), 10);
    const minute = parseInt(useTm.substring(2, 4), 10);
    const second = parseInt(useTm.substring(4, 6), 10);
    return new Date(year, month, day, hour, minute, second);
  }

  return new Date(year, month, day);
}

/**
 * Extracts the last 4 digits of the card number
 */
function extractCardLast4(cardNo: string | null | undefined): string | null {
  if (!cardNo) return null;
  // Keep only digits from the card number
  const digits = cardNo.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : digits;
}

/**
 * Converts CardTransaction → UnifiedPayment
 */
export function convertCardTransaction(
  tx: CardTransactionWithRelations,
  baseCurrency: string = DEFAULT_BASE_CURRENCY
): UnifiedPayment {
  return {
    id: `card_${tx.id}`,
    source: "card",
    transactionDate: parseCardTransactionDate(tx.useDt, tx.useTm),
    merchantName: tx.useStore,
    amount: Number(tx.useAmt),
    currency: baseCurrency,
    approvalNumber: tx.apprNo,
    cardLast4: extractCardLast4(tx.corporateCard?.cardNo),

    // App matching info (uses the matchStatus field directly)
    matchedAppId: tx.matchedAppId,
    matchedApp: tx.matchedApp
      ? { id: tx.matchedApp.id, name: tx.matchedApp.name }
      : null,
    matchConfidence: tx.matchConfidence ?? null,
    matchStatus: tx.matchStatus,
    matchSource: tx.matchSource ?? null,

    // Subscription link
    linkedSubscriptionId: tx.linkedSubscriptionId,
    linkedSubscription: tx.linkedSubscription
      ? {
          id: tx.linkedSubscription.id,
          appName: tx.linkedSubscription.app?.name ?? "Unknown",
        }
      : null,

    // Source ID
    cardTransactionId: tx.id,
    paymentRecordId: null,
  };
}

/**
 * Converts PaymentRecord → UnifiedPayment
 */
export function convertPaymentRecord(
  pr: PaymentRecordWithRelations
): UnifiedPayment {
  return {
    id: `csv_${pr.id}`,
    source: "csv",
    transactionDate: pr.transactionDate,
    merchantName: pr.merchantName,
    amount: Number(pr.amount),
    currency: pr.currency,
    approvalNumber: pr.approvalNumber,
    cardLast4: pr.cardLast4,

    // App matching info
    matchedAppId: pr.matchedAppId,
    matchedApp: pr.matchedApp,
    matchConfidence: pr.matchConfidence,
    matchStatus: pr.matchStatus,
    matchSource: pr.matchSource || null,

    // Subscription link
    linkedSubscriptionId: pr.linkedSubscriptionId,
    linkedSubscription: pr.linkedSubscription
      ? {
          id: pr.linkedSubscription.id,
          appName: pr.linkedSubscription.app?.name ?? "Unknown",
        }
      : null,

    // Source ID
    cardTransactionId: null,
    paymentRecordId: pr.id,
  };
}

/**
 * Queries unified payments (CardTransaction + PaymentRecord union)
 */
export async function getUnifiedPayments(
  options: UnifiedPaymentOptions
): Promise<{ records: UnifiedPayment[]; total: number }> {
  const {
    organizationId,
    page = 1,
    limit = 10,
    matchStatus,
    appId,
    startDate,
    endDate,
    source = "all",
  } = options;

  const skip = (page - 1) * limit;

  // 1. Query CardTransaction (when source is not 'csv')
  let cardTransactions: CardTransactionWithRelations[] = [];
  let cardTotal = 0;

  if (source !== "csv") {
    // Build CardTransaction query conditions
    const cardWhere: Prisma.CardTransactionWhereInput = {
      organizationId,
    };

    // Apply the matchStatus filter
    if (matchStatus) {
      if (Array.isArray(matchStatus)) {
        cardWhere.matchStatus = { in: matchStatus };
      } else {
        cardWhere.matchStatus = matchStatus;
      }
    }

    // Apply the appId filter
    if (appId) {
      cardWhere.matchedAppId = appId;
    }

    // Date filter (useDt is a YYYYMMDD string)
    if (startDate) {
      const startStr = startDate.toISOString().slice(0, 10).replace(/-/g, "");
      cardWhere.useDt = { gte: startStr };
    }
    if (endDate) {
      const endStr = endDate.toISOString().slice(0, 10).replace(/-/g, "");
      if (cardWhere.useDt && typeof cardWhere.useDt === "object") {
        (cardWhere.useDt as Prisma.StringFilter<"CardTransaction">).lte =
          endStr;
      } else {
        cardWhere.useDt = { lte: endStr };
      }
    }

    [cardTransactions, cardTotal] = await Promise.all([
      prisma.cardTransaction.findMany({
        where: cardWhere,
        include: {
          corporateCard: true,
          matchedApp: true,
          linkedSubscription: {
            include: { app: true },
          },
        },
        orderBy: { useDt: "desc" },
      }),
      prisma.cardTransaction.count({ where: cardWhere }),
    ]);
  }

  // 2. Query PaymentRecord (when source is not 'card')
  let paymentRecords: PaymentRecordWithRelations[] = [];
  let csvTotal = 0;

  if (source !== "card") {
    const csvWhere: Prisma.PaymentRecordWhereInput = {
      organizationId,
    };

    if (matchStatus) {
      if (Array.isArray(matchStatus)) {
        csvWhere.matchStatus = { in: matchStatus };
      } else {
        csvWhere.matchStatus = matchStatus;
      }
    }
    if (appId) {
      csvWhere.matchedAppId = appId;
    }
    if (startDate || endDate) {
      csvWhere.transactionDate = {};
      if (startDate) {
        (csvWhere.transactionDate as Prisma.DateTimeFilter).gte = startDate;
      }
      if (endDate) {
        (csvWhere.transactionDate as Prisma.DateTimeFilter).lte = endDate;
      }
    }

    [paymentRecords, csvTotal] = await Promise.all([
      prisma.paymentRecord.findMany({
        where: csvWhere,
        include: {
          matchedApp: true,
          linkedSubscription: {
            include: { app: true },
          },
        },
        orderBy: { transactionDate: "desc" },
      }),
      prisma.paymentRecord.count({ where: csvWhere }),
    ]);
  }

  // 3. Union and sort
  const baseCurrency = await getBaseCurrency(organizationId);
  const allRecords: UnifiedPayment[] = [
    ...cardTransactions.map((tx) => convertCardTransaction(tx, baseCurrency)),
    ...paymentRecords.map(convertPaymentRecord),
  ];

  // Sort by date descending
  allRecords.sort(
    (a, b) => b.transactionDate.getTime() - a.transactionDate.getTime()
  );

  // 4. Apply pagination
  const paginatedRecords = allRecords.slice(skip, skip + limit);

  return {
    records: paginatedRecords,
    total: cardTotal + csvTotal,
  };
}

/**
 * Aggregates unified payment amounts (monthly)
 */
export async function getUnifiedPaymentTotals(
  organizationId: string,
  startDate: Date,
  endDate?: Date
): Promise<{ cardTotal: number; csvTotal: number; total: number }> {
  // CardTransaction total (approvals only)
  const cardWhere: Prisma.CardTransactionWhereInput = {
    organizationId,
    transactionType: "APPROVAL", // Query approvals only
  };

  const startStr = startDate.toISOString().slice(0, 10).replace(/-/g, "");
  cardWhere.useDt = { gte: startStr };

  if (endDate) {
    const endStr = endDate.toISOString().slice(0, 10).replace(/-/g, "");
    (cardWhere.useDt as Prisma.StringFilter<"CardTransaction">).lte = endStr;
  }

  const cardAgg = await prisma.cardTransaction.aggregate({
    where: cardWhere,
    _sum: { useAmt: true },
  });

  // PaymentRecord total (matched only)
  const csvWhere: Prisma.PaymentRecordWhereInput = {
    organizationId,
    matchStatus: { in: ["MANUAL", "AUTO_MATCHED"] },
    transactionDate: { gte: startDate },
  };

  if (endDate) {
    (csvWhere.transactionDate as Prisma.DateTimeFilter).lte = endDate;
  }

  const csvAgg = await prisma.paymentRecord.aggregate({
    where: csvWhere,
    _sum: { amount: true },
  });

  const cardTotal = Number(cardAgg._sum.useAmt || 0);
  const csvTotal = Number(csvAgg._sum.amount || 0);

  return {
    cardTotal,
    csvTotal,
    total: cardTotal + csvTotal,
  };
}

/**
 * Counts unmatched payments
 */
export async function getUnifiedUnmatchedCount(
  organizationId: string
): Promise<{ cardCount: number; csvCount: number; total: number }> {
  const [cardCount, csvCount] = await Promise.all([
    // Unmatched CardTransaction (PENDING only — UNMATCHED means already classified non-SaaS)
    prisma.cardTransaction.count({
      where: {
        organizationId,
        transactionType: "APPROVAL",
        matchStatus: "PENDING",
      },
    }),
    // Unmatched PaymentRecord (PENDING only)
    prisma.paymentRecord.count({
      where: {
        organizationId,
        matchStatus: "PENDING",
      },
    }),
  ]);

  return {
    cardCount,
    csvCount,
    total: cardCount + csvCount,
  };
}
