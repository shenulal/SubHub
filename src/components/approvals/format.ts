// src/components/approvals/format.ts
import { formatDistanceToNow } from "date-fns";

export function formatMoney(
  amount: number,
  currency: string,
  locale = "en"
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString(locale)}`;
  }
}

export function formatDate(
  iso: string | null | undefined,
  locale = "en"
): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(iso)
  );
}

export function formatDateTime(
  iso: string | null | undefined,
  locale = "en"
): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export function userLabel(
  user: { name: string | null; email: string } | null | undefined,
  fallback: string
): string {
  if (!user) return fallback;
  return user.name?.trim() || user.email;
}

export function initials(name: string): string {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Calendar date stored as `YYYY-MM-DD` (no time zone shift). */
export function formatDateOnly(
  value: string | null | undefined,
  locale = "en"
): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}
