// src/components/super-admin/analytics/analytics-format.ts
/** Client-safe formatting for Control Panel analytics (English, en-GB dates). */
import { formatMoney } from "@/lib/fx/convert";
import { formatMoneyCompact } from "@/lib/services/discovery/money";

const LOCALE = "en";

export const money = (amount: number, currency: string) =>
  formatMoney(amount, currency, LOCALE);

export const moneyCompact = (amount: number, currency: string) =>
  formatMoneyCompact(amount, currency, LOCALE);

const MONTH_FORMAT = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

/** "2026-11" → "Nov 26". */
export function formatMonth(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return MONTH_FORMAT.format(new Date(Date.UTC(year, month - 1, 1)));
}

export const percentOf = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

/** Chart palette (Materio chart tokens) — keeps both themes intentional. */
export const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--magenta-primary)",
] as const;

export const seriesColor = (index: number) =>
  SERIES_COLORS[index % SERIES_COLORS.length];

/** Labels for code-defined workflow states (subscriptions). */
export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  PENDING: "Pending",
  PAUSED: "Paused",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  ARCHIVED: "Archived",
};
