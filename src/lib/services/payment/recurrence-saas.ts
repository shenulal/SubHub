// src/lib/services/payment/recurrence-saas.ts
/**
 * SaaS subscription pattern analysis
 */
import { normalizeMerchantName } from "./merchant-matcher";
import type {
  MinimalPurchase,
  MonthlyTransaction,
  SaaSHeuristicOptions,
  SaaSSubscriptionHint,
} from "./recurrence.types";
import {
  calculateDayVariation,
  calculateVariation,
  parseDayOfMonth,
  parseMonthKey,
} from "./recurrence.utils";

/**
 * Analyses the likelihood that each merchant is a SaaS subscription
 * - Monthly recurrence frequency
 * - Amount similarity (±10%)
 * - Day-of-month pattern (±3 days)
 *
 * @param purchases Transactions
 * @param options Heuristic options
 * @returns SaaS subscription hints per merchant
 */
export function analyzeSaaSSubscriptionPatterns(
  purchases: MinimalPurchase[],
  options: SaaSHeuristicOptions = {}
): Map<string, SaaSSubscriptionHint> {
  const {
    amountTolerance = 0.1,
    minMonthCount = 2,
    dayTolerance = 3,
  } = options;

  // Group transactions by merchant and month
  const merchantTxMap = new Map<string, MonthlyTransaction[]>();

  for (const p of purchases) {
    const month = parseMonthKey(p.useDt);
    const day = parseDayOfMonth(p.useDt);
    if (!month || day === null) continue;

    const normalized = normalizeMerchantName(p.useStore);
    const amount = Number.parseFloat(p.useAmt) || 0;
    if (amount <= 0) continue;

    const existing = merchantTxMap.get(normalized) || [];
    existing.push({ month, day, amount });
    merchantTxMap.set(normalized, existing);
  }

  const result = new Map<string, SaaSSubscriptionHint>();

  for (const [merchant, transactions] of merchantTxMap) {
    const hint = analyzeTransactions(
      transactions,
      amountTolerance,
      minMonthCount,
      dayTolerance
    );
    if (hint) {
      result.set(merchant, hint);
    }
  }

  return result;
}

function analyzeTransactions(
  transactions: MonthlyTransaction[],
  amountTolerance: number,
  minMonthCount: number,
  dayTolerance: number
): SaaSSubscriptionHint | null {
  // Group by month (a month may have several transactions)
  const monthlyGroups = new Map<string, MonthlyTransaction[]>();
  for (const tx of transactions) {
    const existing = monthlyGroups.get(tx.month) || [];
    existing.push(tx);
    monthlyGroups.set(tx.month, existing);
  }

  // Pick the representative transaction per month (highest amount)
  const monthlyRepresentatives: MonthlyTransaction[] = [];
  for (const txs of monthlyGroups.values()) {
    const maxTx = txs.reduce(
      (max, tx) => (tx.amount > max.amount ? tx : max),
      txs[0]
    );
    monthlyRepresentatives.push(maxTx);
  }

  const monthCount = monthlyRepresentatives.length;
  if (monthCount < minMonthCount) {
    return null;
  }

  const reasons: string[] = [];
  let score = 0;

  // 1. Monthly frequency score (up to 30 points)
  if (monthCount >= 6) {
    score += 30;
    reasons.push(`Paid for 6+ consecutive months (${monthCount} months)`);
  } else if (monthCount >= 3) {
    score += 20;
    reasons.push(`Paid for 3+ consecutive months (${monthCount} months)`);
  } else if (monthCount >= 2) {
    score += 10;
    reasons.push(`Paid for 2 consecutive months`);
  }

  // 2. Amount consistency score (up to 40 points)
  const amounts = monthlyRepresentatives.map((tx) => tx.amount);
  const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const amountVariation = calculateVariation(amounts, avgAmount);

  if (amountVariation <= amountTolerance) {
    score += 40;
    reasons.push(
      `High amount consistency (variation ${(amountVariation * 100).toFixed(1)}%)`
    );
  } else if (amountVariation <= amountTolerance * 2) {
    score += 25;
    reasons.push(
      `Moderate amount consistency (variation ${(amountVariation * 100).toFixed(1)}%)`
    );
  } else if (amountVariation <= amountTolerance * 3) {
    score += 10;
    reasons.push(
      `Amount varies (variation ${(amountVariation * 100).toFixed(1)}%)`
    );
  }

  // 3. Day-of-month consistency score (up to 30 points)
  const days = monthlyRepresentatives.map((tx) => tx.day);
  const dayVariation = calculateDayVariation(days);

  if (dayVariation <= dayTolerance) {
    score += 30;
    reasons.push(`Consistent payment day (±${dayVariation.toFixed(1)} days)`);
  } else if (dayVariation <= dayTolerance * 2) {
    score += 15;
    reasons.push(`Payment day varies (±${dayVariation.toFixed(1)} days)`);
  }

  // Return null when below the minimum score
  if (score < 20) {
    return null;
  }

  return {
    score,
    reasons,
    monthCount,
    avgAmount,
    amountVariation,
  };
}

/**
 * Converts the heuristic result into a recurrenceHint string
 */
export function formatSaaSHintForLLM(hint: SaaSSubscriptionHint): string {
  const parts = [
    `saas_score=${hint.score}`,
    `months=${hint.monthCount}`,
    `avg_amount=${hint.avgAmount.toFixed(0)}`,
    `amount_var=${(hint.amountVariation * 100).toFixed(1)}%`,
  ];

  if (hint.reasons.length > 0) {
    parts.push(`patterns=[${hint.reasons.join("; ")}]`);
  }

  return parts.join(", ");
}
