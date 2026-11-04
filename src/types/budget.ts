// src/types/budget.ts
// 예산 설정 관련 타입 정의
import { ZERO_DECIMAL_CURRENCIES as FX_ZERO_DECIMAL } from "@/lib/fx/convert";
import { SETTING_DEFINITIONS } from "@/lib/settings/registry";

/**
 * 지원하는 통화 단위
 */
export type Currency = string;

/**
 * 통화 정보 (표시용)
 */
export interface CurrencyInfo {
  code: Currency;
  symbol: string;
  name: string;
  locale: string;
}

/**
 * 지원하는 통화 목록
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
 * 예산 설정 인터페이스
 */
export interface BudgetSettings {
  /** 통화 단위 */
  currency: Currency;
  /** 월별 예산 금액 (null = 전월 카드 매입 승인 내역 총액 사용) */
  monthlyBudget: number | null;
  /** 예산 경고 임계값 (%, 기본 80) */
  alertThreshold: number;
}

/**
 * 기본 예산 설정
 */
export const DEFAULT_BUDGET_SETTINGS: BudgetSettings = {
  currency: SETTING_DEFINITIONS["finance.baseCurrency"].defaultValue,
  monthlyBudget: SETTING_DEFINITIONS["finance.monthlyBudget"].defaultValue,
  alertThreshold:
    SETTING_DEFINITIONS["finance.budgetAlertThresholdPercent"].defaultValue,
};

/**
 * 통화 포맷팅 함수
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
 * 통화 정보 조회
 */
export function getCurrencyInfo(currency: Currency): CurrencyInfo | undefined {
  return CURRENCIES.find((c) => c.code === currency);
}
