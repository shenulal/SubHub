// src/lib/services/payment/recurrence.ts
/**
 * Unified payment recurrence analysis module
 *
 * Re-exports everything to keep existing imports working:
 * - recurrence.types.ts: type definitions
 * - recurrence.utils.ts: utilities
 * - recurrence-detection.ts: monthly recurring payment detection
 * - recurrence-saas.ts: SaaS pattern analysis
 * - recurrence-interval.ts: payment interval analysis
 */

// Types re-export
export type {
  BillingCycle,
  DateTransaction,
  MinimalPurchase,
  MonthlyRecurrence,
  MonthlyTransaction,
  RecurrencePattern,
  SaaSHeuristicOptions,
  SaaSSubscriptionHint,
} from "./recurrence.types";

// Utils re-export (internal use)
export {
  calculateDayVariation,
  calculateVariation,
  parseDateString,
  parseDayOfMonth,
  parseMinutes,
  parseMonthKey,
} from "./recurrence.utils";

// Detection re-export
export { detectMonthlyRecurrence } from "./recurrence-detection";

// SaaS analysis re-export
export {
  analyzeSaaSSubscriptionPatterns,
  formatSaaSHintForLLM,
} from "./recurrence-saas";

// Interval analysis re-export
export { analyzePaymentIntervals } from "./recurrence-interval";
