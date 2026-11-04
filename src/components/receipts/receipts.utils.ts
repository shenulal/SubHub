// src/components/receipts/receipts.utils.ts
/** Small pure helpers shared by the receipts UI. */
import type { BillingCycle, ReceiptSuggestionStatus } from "@prisma/client";

export type ConfidenceLevel = "high" | "medium" | "low";

/** Display buckets for the 0–1 confidence score (presentation only). */
export const CONFIDENCE_LEVELS: Record<ConfidenceLevel, number> = {
  high: 0.85,
  medium: 0.65,
  low: 0,
};

export function confidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= CONFIDENCE_LEVELS.high) return "high";
  if (confidence >= CONFIDENCE_LEVELS.medium) return "medium";
  return "low";
}

export function formatMoney(
  amount: number | null,
  currency: string | null,
  locale = "en"
): string | null {
  if (amount === null) return null;
  if (!currency) return amount.toFixed(2);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "code",
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatDate(
  iso: string | null,
  locale = "en",
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  }
): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    ...options,
  }).format(date);
}

export function formatRelative(
  iso: string | null,
  now = Date.now()
): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const minutes = Math.round((now - then) / 60_000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(minutes) < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(-hours, "hour");
  return rtf.format(-Math.round(hours / 24), "day");
}

/** `2026-02-05T00:00:00.000Z` → `2026-02-05` for <input type="date"> */
export function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export function vendorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return initials.join("") || "?";
}

export const QUEUE_TABS: ReceiptSuggestionStatus[] = [
  "NEW",
  "DUPLICATE",
  "ACCEPTED",
  "DISMISSED",
];

export const CYCLE_OPTIONS: BillingCycle[] = [
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
  "ONE_TIME",
];

export function isOpenStatus(status: ReceiptSuggestionStatus): boolean {
  return status === "NEW" || status === "DUPLICATE";
}

/** True when the receipt amount differs from the matched subscription amount. */
export function hasPriceDrift(
  amount: number | null,
  currency: string | null,
  matched: { amount: number; currency: string } | null
): boolean {
  if (!matched || amount === null || !currency) return false;
  if (currency.toUpperCase() !== matched.currency.toUpperCase()) return false;
  return Math.abs(amount - matched.amount) >= 0.005;
}
