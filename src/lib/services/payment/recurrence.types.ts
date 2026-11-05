// src/lib/services/payment/recurrence.types.ts

/**
 * Minimal payment info (card company raw data format)
 */
export interface MinimalPurchase {
  /** Transaction date (YYYYMMDD) */
  useDt: string;
  /** Transaction time (HHMM) */
  useTm?: string | null;
  /** Merchant name */
  useStore: string;
  /** Transaction amount */
  useAmt: string;
}

/**
 * Monthly transaction info
 */
export interface MonthlyTransaction {
  /** Month (YYYYMM) */
  month: string;
  /** Day (1-31) */
  day: number;
  /** Amount */
  amount: number;
}

/**
 * Monthly recurring payment info
 */
export interface MonthlyRecurrence {
  /** Number of occurrences (months) */
  count: number;
  /** Minimum amount */
  minAmount: number;
  /** Maximum amount */
  maxAmount: number;
}

/**
 * SaaS subscription heuristic result
 */
export interface SaaSSubscriptionHint {
  /**
   * SaaS subscription likelihood score (0-100)
   * - 50 or above: likely SaaS
   * - 30-50: uncertain
   * - Below 30: unlikely SaaS
   */
  score: number;
  /** Descriptions of detected patterns */
  reasons: string[];
  /** Number of distinct months with transactions */
  monthCount: number;
  /** Average amount */
  avgAmount: number;
  /** Amount variation ratio (0-1; closer to 0 is more consistent) */
  amountVariation: number;
}

/**
 * SaaS heuristic options
 */
export interface SaaSHeuristicOptions {
  /** Amount similarity tolerance (default: 0.1 = ±10%) */
  amountTolerance?: number;
  /** Minimum number of months (default: 2) */
  minMonthCount?: number;
  /** Day similarity tolerance (default: 3 days) */
  dayTolerance?: number;
}

/**
 * Billing cycle type
 */
export type BillingCycle = "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL";

/**
 * Recurring payment pattern analysis result
 */
export interface RecurrencePattern {
  /** Whether the payments were classified as recurring */
  isRecurring: boolean;
  /** Billing cycle */
  billingCycle: BillingCycle | null;
  /** Average interval (days) */
  avgIntervalDays: number;
  /** Interval standard deviation (days) */
  intervalStdDev: number;
  /** Predicted next payment date */
  nextPaymentDate: Date | null;
  /** Last payment date */
  lastPaymentDate: Date | null;
  /** Number of transactions analysed */
  transactionCount: number;
  /** Average amount */
  avgAmount: number;
}

/**
 * Transaction info by date (internal use)
 */
export interface DateTransaction {
  date: Date;
  amount: number;
}
