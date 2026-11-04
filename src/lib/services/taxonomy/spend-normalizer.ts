// src/lib/services/taxonomy/spend-normalizer.ts
/**
 * Monthly normalisation for category spend. Cycle lengths come from the
 * organisation's `BillingCycleConfig` rows (months); a cycle with 0 months
 * (one-time) contributes nothing to the recurring monthly figure.
 */

export type CycleMonthsMap = Record<string, number>;

export function monthlyAmount(
  amount: number,
  billingCycle: string,
  cycleMonths: CycleMonthsMap
): number {
  const months = cycleMonths[billingCycle];
  if (!months || months <= 0) return 0;
  return amount / months;
}

export interface SpendInput {
  categoryId: string | null;
  amount: number;
  billingCycle: string;
  currency: string;
}

export interface SpendBucket {
  categoryId: string;
  monthlyTotal: number;
  count: number;
}

/**
 * Groups subscriptions by category after converting to base currency.
 * `rateToBase(currency)` returns the multiplier for that currency; the caller
 * decides where rates come from (FX service or a flat 1).
 */
export function bucketSpendByCategory(
  rows: SpendInput[],
  cycleMonths: CycleMonthsMap,
  rateToBase: (currency: string) => number,
  uncategorisedKey = "__uncategorised__"
): SpendBucket[] {
  const buckets = new Map<string, SpendBucket>();
  for (const row of rows) {
    const key = row.categoryId ?? uncategorisedKey;
    const monthly =
      monthlyAmount(row.amount, row.billingCycle, cycleMonths) *
      rateToBase(row.currency);
    const existing = buckets.get(key) ?? {
      categoryId: key,
      monthlyTotal: 0,
      count: 0,
    };
    buckets.set(key, {
      ...existing,
      monthlyTotal: existing.monthlyTotal + monthly,
      count: existing.count + 1,
    });
  }
  return Array.from(buckets.values()).sort(
    (a, b) => b.monthlyTotal - a.monthlyTotal
  );
}

export function roundMoney(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
