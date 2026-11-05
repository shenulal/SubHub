// src/actions/cost-analytics-utils.ts

/**
 * Extract a number from a Prisma Decimal or an object
 */
export function extractAmount(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value) || 0;
}

/**
 * Convert a date to YYYY-MM format
 */
export function formatMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Convert YYYY-MM to a display label ("MMM yyyy", e.g. "Jun 2024")
 */
export function formatDisplayLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Determine severity from the change rate
 */
export function getSeverity(changeRate: number): "low" | "medium" | "high" {
  if (changeRate >= 200) return "high";
  if (changeRate >= 100) return "medium";
  return "low";
}

/**
 * Calculate a subscription's monthly cost
 */
export function calculateMonthlyCost(sub: {
  amount: unknown;
  billingCycle: string;
}): number {
  const amount = extractAmount(sub.amount);

  switch (sub.billingCycle) {
    case "YEARLY":
      return Math.round(amount / 12);
    case "QUARTERLY":
      return Math.round(amount / 3);
    case "MONTHLY":
    default:
      return amount;
  }
}

/**
 * Convert a date to a YYYYMMDD string
 */
export function formatDateStr(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * SMP-134: Calculate the per-seat price of a PER_SEAT subscription
 * amount ÷ totalLicenses (PER_SEAT only)
 */
export function calculatePerSeatPrice(sub: {
  amount: unknown;
  totalLicenses: number | null;
  billingType: string;
}): number | null {
  if (sub.billingType !== "PER_SEAT" || !sub.totalLicenses) return null;
  const amount = extractAmount(sub.amount);
  return Math.round(amount / sub.totalLicenses);
}

/**
 * SMP-134: Normalize the per-seat price to monthly (yearly/quarterly → monthly)
 */
export function calculateMonthlyPerSeatPrice(sub: {
  amount: unknown;
  totalLicenses: number | null;
  billingType: string;
  billingCycle: string;
}): number | null {
  if (sub.billingType !== "PER_SEAT" || !sub.totalLicenses) return null;
  const monthlyCost = calculateMonthlyCost(sub);
  return Math.round(monthlyCost / sub.totalLicenses);
}

/**
 * SMP-134: Format the per-seat price for display
 */
export function formatPerSeatPrice(
  price: number | null,
  currency: string = DEFAULT_BASE_CURRENCY
): string {
  if (price === null) return "";
  const formatted = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(price);
  return `${formatted}/Seat`;
}
import { DEFAULT_BASE_CURRENCY } from "@/lib/fx/convert";
