// src/types/budget.ts
// Budget settings types
import { SETTING_DEFINITIONS } from "@/lib/settings/registry";

/** ISO 4217 code from the currency master (e.g. AED). */
export type Currency = string;

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
