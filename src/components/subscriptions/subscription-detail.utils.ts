// src/components/subscriptions/subscription-detail.utils.ts

import { formatMoney } from "@/lib/fx/convert";

/**
 * Format an amount as currency
 */
export function formatCurrency(amount: number, currency: string): string {
  return formatMoney(amount, currency);
}

/**
 * Format a date as YYYY.MM.DD
 */
export function formatDate(date: Date | null): string {
  if (!date) return "-";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

/**
 * Calculate the days remaining until renewal
 */
export function getDaysUntilRenewal(renewalDate: Date | null): number | null {
  if (!renewalDate) return null;
  const today = new Date();
  const renewal = new Date(renewalDate);
  const diff = Math.ceil(
    (renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  return diff;
}
