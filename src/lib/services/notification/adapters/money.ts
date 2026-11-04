// src/lib/services/notification/adapters/money.ts
/**
 * Adapter over the Platform agent's FX helper (`@/lib/fx`).
 * Falls back to Intl formatting if the helper is unavailable at runtime.
 */
import { formatMoney } from "@/lib/fx";

export function formatMoneyForNotification(
  amount: number,
  currency: string,
  locale = "en"
): string {
  try {
    const out = (
      formatMoney as unknown as (a: number, c: string, l?: string) => unknown
    )(amount, currency, locale);
    if (typeof out === "string" && out.length > 0) return out;
  } catch {
    // fall through to Intl
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
