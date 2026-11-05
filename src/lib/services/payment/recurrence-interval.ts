// src/lib/services/payment/recurrence-interval.ts
/**
 * Billing cycle analysis based on payment intervals
 */
import { normalizeMerchantName } from "./merchant-matcher";
import type {
  BillingCycle,
  DateTransaction,
  MinimalPurchase,
  RecurrencePattern,
} from "./recurrence.types";
import { parseDateString } from "./recurrence.utils";

/**
 * Recurring payment analysis based on payment intervals
 *
 * Per the PRD:
 * - Standard deviation < 5 days → recurring payment
 * - Cycle determined from the average interval:
 *   * < 35 days: MONTHLY
 *   * 35–100 days: QUARTERLY
 *   * 100–200 days: SEMI_ANNUAL
 *   * > 300 days: ANNUAL
 * - Next payment date prediction: lastDate + avgInterval
 */
export function analyzePaymentIntervals(
  purchases: MinimalPurchase[],
  options: {
    /**
     * Standard deviation threshold for recurring payments (days)
     * Per the PRD: 5 days
     */
    stdDevThreshold?: number;
    /**
     * Minimum number of transactions
     */
    minTransactionCount?: number;
  } = {}
): Map<string, RecurrencePattern> {
  const { stdDevThreshold = 5, minTransactionCount = 2 } = options;

  // Group transactions by merchant
  const merchantTxMap = new Map<string, DateTransaction[]>();

  for (const p of purchases) {
    const date = parseDateString(p.useDt);
    if (!date) continue;

    const normalized = normalizeMerchantName(p.useStore);
    const amount = Number.parseFloat(p.useAmt) || 0;
    if (amount <= 0) continue;

    const existing = merchantTxMap.get(normalized) || [];
    existing.push({ date, amount });
    merchantTxMap.set(normalized, existing);
  }

  const result = new Map<string, RecurrencePattern>();

  for (const [merchant, transactions] of merchantTxMap) {
    if (transactions.length < minTransactionCount) continue;

    const pattern = analyzeIntervals(
      transactions,
      stdDevThreshold,
      minTransactionCount
    );
    result.set(merchant, pattern);
  }

  return result;
}

function analyzeIntervals(
  transactions: DateTransaction[],
  stdDevThreshold: number,
  minTransactionCount: number
): RecurrencePattern {
  // Sort by date
  const sorted = [...transactions].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  const transactionCount = sorted.length;
  const amounts = sorted.map((t) => t.amount);
  const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const lastPaymentDate = sorted[sorted.length - 1].date;

  // Intervals cannot be calculated with fewer than 2 transactions
  if (transactionCount < minTransactionCount) {
    return {
      isRecurring: false,
      billingCycle: null,
      avgIntervalDays: 0,
      intervalStdDev: 0,
      nextPaymentDate: null,
      lastPaymentDate,
      transactionCount,
      avgAmount,
    };
  }

  // Calculate intervals
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const diffMs = sorted[i].date.getTime() - sorted[i - 1].date.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    intervals.push(diffDays);
  }

  // Average interval
  const avgIntervalDays =
    intervals.reduce((a, b) => a + b, 0) / intervals.length;

  // Calculate standard deviation
  const squaredDiffs = intervals.map((i) => Math.pow(i - avgIntervalDays, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / intervals.length;
  const intervalStdDev = Math.sqrt(variance);

  // Recurring if standard deviation < threshold
  const isRecurring = intervalStdDev < stdDevThreshold;

  // Determine the cycle
  const billingCycle = isRecurring
    ? determineBillingCycle(avgIntervalDays)
    : null;

  // Predict the next payment date
  const nextPaymentDate = isRecurring
    ? new Date(
        lastPaymentDate.getTime() + avgIntervalDays * 24 * 60 * 60 * 1000
      )
    : null;

  return {
    isRecurring,
    billingCycle,
    avgIntervalDays: Math.round(avgIntervalDays * 10) / 10,
    intervalStdDev: Math.round(intervalStdDev * 10) / 10,
    nextPaymentDate,
    lastPaymentDate,
    transactionCount,
    avgAmount,
  };
}

/**
 * Determines the billing cycle from the average interval
 *
 * - < 35 days: MONTHLY
 * - 35–100 days: QUARTERLY
 * - 100–200 days: SEMI_ANNUAL
 * - > 300 days: ANNUAL
 */
function determineBillingCycle(avgIntervalDays: number): BillingCycle {
  if (avgIntervalDays < 35) {
    return "MONTHLY";
  }
  if (avgIntervalDays < 100) {
    return "QUARTERLY";
  }
  if (avgIntervalDays < 200) {
    return "SEMI_ANNUAL";
  }
  return "ANNUAL";
}
