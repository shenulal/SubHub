// src/lib/services/payment/recurrence-detection.ts
/**
 * Detects monthly recurring payments
 */
import { normalizeMerchantName } from "./merchant-matcher";
import type { MinimalPurchase, MonthlyRecurrence } from "./recurrence.types";
import {
  parseDayOfMonth,
  parseMinutes,
  parseMonthKey,
} from "./recurrence.utils";

/**
 * Detects monthly recurring payments
 * - Treated as recurring when the same merchant appears 2+ times on the same day and time (±1 minute) each month
 */
export function detectMonthlyRecurrence(
  purchases: MinimalPurchase[]
): Map<string, MonthlyRecurrence> {
  // key: normalized|day|minuteSlot (stored in three slots to allow a ±1 minute tolerance)
  const bucketMap = new Map<
    string,
    {
      months: Set<string>;
      minAmount: number;
      maxAmount: number;
      normalized: string;
    }
  >();

  for (const p of purchases) {
    const day = parseDayOfMonth(p.useDt);
    const minutes = parseMinutes(p.useTm);
    const monthKey = parseMonthKey(p.useDt);
    if (day === null || minutes === null || !monthKey) continue;

    const normalized = normalizeMerchantName(p.useStore);
    const amount = Number.parseFloat(p.useAmt) || 0;

    for (let delta = -1; delta <= 1; delta += 1) {
      const minuteSlot = minutes + delta;
      if (minuteSlot < 0 || minuteSlot >= 24 * 60) continue;
      const key = `${normalized}|${day}|${minuteSlot}`;
      const existing = bucketMap.get(key);
      if (existing) {
        existing.months.add(monthKey);
        existing.minAmount = Math.min(existing.minAmount, amount);
        existing.maxAmount = Math.max(existing.maxAmount, amount);
      } else {
        bucketMap.set(key, {
          months: new Set([monthKey]),
          minAmount: amount,
          maxAmount: amount,
          normalized,
        });
      }
    }
  }

  // Keep only the top results by month coverage per bucket
  const result = new Map<string, MonthlyRecurrence>();

  for (const bucket of bucketMap.values()) {
    const monthCount = bucket.months.size;
    if (monthCount < 2) continue;

    const existing = result.get(bucket.normalized);
    if (!existing || monthCount > existing.count) {
      result.set(bucket.normalized, {
        count: monthCount,
        minAmount: bucket.minAmount,
        maxAmount: bucket.maxAmount,
      });
    } else if (existing && monthCount === existing.count) {
      result.set(bucket.normalized, {
        count: existing.count,
        minAmount: Math.min(existing.minAmount, bucket.minAmount),
        maxAmount: Math.max(existing.maxAmount, bucket.maxAmount),
      });
    }
  }

  return result;
}
