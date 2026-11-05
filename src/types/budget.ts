// src/types/budget.ts
// Budget settings types
import { ZERO_DECIMAL_CURRENCIES as FX_ZERO_DECIMAL } from "@/lib/fx/convert";
import { SETTING_DEFINITIONS } from "@/lib/settings/registry";

/**
 * Supported currency units
 */
export type Currency = string;

/**
 * Currency info (for display)
 */
export interface CurrencyInfo {
  code: Currency;
  symbol: string;
  name: string;
  locale: string;
}

/**
 * Supported currencies
 */
export const CURRENCIES: CurrencyInfo[] = [
  { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
  { code: "AED", symbol: "AED", name: "UAE Dirham", locale: "en-AE" },
  { code: "SAR", symbol: "SAR", name: "Saudi Riyal", locale: "en-SA" },
  { code: "EUR", symbol: "€", name: "Euro", locale: "de-DE" },
  { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB" },
  { code: "KRW", symbol: "₩", name: "Korean Won", locale: "ko-KR" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", locale: "ja-JP" },
  { code: "INR", symbol: "₹", name: "Indian Rupee", locale: "en-IN" },
];

/** Currencies with no minor units in everyday display */
export const ZERO_DECIMAL_CURRENCIES: ReadonlySet<string> = FX_ZERO_DECIMAL;

/**
 * Budget settings interface
 */
export interface BudgetSettings {
  /** Currency unit */
  currency: Currency;
  /** Monthly budget amount (null = use last month's total approved card spend) */
  monthlyBudget: number | null;
  /** Budget alert threshold (%, default 80) */
  alertThreshold: number;
}

/**
 * Default budget settings
 */
export const DEFAULT_BUDGET_SETTINGS: BudgetSettings = {
  currency: SETTING_DEFINITIONS["finance.baseCurrency"].defaultValue,
  monthlyBudget: SETTING_DEFINITIONS["finance.monthlyBudget"].defaultValue,
  alertThreshold:
    SETTING_DEFINITIONS["finance.budgetAlertThresholdPercent"].defaultValue,
};

/**
 * Currency formatting function
 */
export function formatCurrencyAmount(
  amount: number,
  currency: Currency
): string {
  const currencyInfo = CURRENCIES.find((c) => c.code === currency);
  const locale = currencyInfo?.locale || "en-US";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2,
  }).format(amount);
}

/**
 * Look up currency info
 */
export function getCurrencyInfo(currency: Currency): CurrencyInfo | undefined {
  return CURRENCIES.find((c) => c.code === currency);
}
