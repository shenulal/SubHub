/**
 * Cost analytics types
 * Phase 10: cost analytics dashboard
 */

/**
 * Cost statistics summary
 */
export interface CostStatistics {
  /** Total cost (base currency) */
  totalCost: number;
  /** Average monthly cost */
  monthlyAverage: number;
  /** Month-over-month change (%) - positive: increase, negative: decrease */
  costChange: number;
  /** Month-over-month absolute difference (base currency) - positive: increase, negative: decrease */
  costDifference: number;
  /** Transaction count */
  transactionCount: number;
  /** Currency code */
  currency: string;
  /** Analysis period start date */
  periodStart: Date;
  /** Analysis period end date */
  periodEnd: Date;
  /** Total cost (SaaS + non-SaaS) */
  totalCostAll: number;
}

/**
 * Cost distribution by app
 */
export interface AppCostDistribution {
  /** App ID */
  appId: string;
  /** App name */
  appName: string;
  /** App logo URL (optional) */
  appLogoUrl?: string;
  /** Total cost */
  totalCost: number;
  /** Share of total cost (%) */
  percentage: number;
  /** Transaction count */
  transactionCount: number;
}

/**
 * Monthly cost trend
 */
export interface MonthlyCostTrend {
  /** Month identifier (YYYY-MM) */
  month: string;
  /** Display label (e.g. "Jan 2024") */
  displayLabel: string;
  /** Total cost for the month (kept for compatibility) */
  totalCost: number;
  /** SaaS cost (payments matched to an app) */
  saasCost: number;
  /** Non-SaaS cost (unmatched payments) */
  nonSaasCost: number;
  /** Total transaction count for the month */
  transactionCount: number;
  /** SaaS transaction count */
  saasTransactionCount: number;
  /** Non-SaaS transaction count */
  nonSaasTransactionCount: number;
}

/**
 * Cost analytics filter
 */
export interface CostAnalyticsFilters {
  /** Start date */
  startDate?: Date;
  /** End date */
  endDate?: Date;
  /** Filter to specific apps (optional) */
  appIds?: string[];
  /** Team filter (optional) */
  teamId?: string;
  /** User filter (optional) */
  userId?: string;
}

/**
 * Cost anomaly
 */
export interface CostAnomaly {
  /** App ID */
  appId: string;
  /** App name */
  appName: string;
  /** Current month cost */
  currentCost: number;
  /** Previous month cost */
  previousCost: number;
  /** Change rate (%) */
  changeRate: number;
  /** Severity - low: 50-100%, medium: 100-200%, high: 200%+ */
  severity: "low" | "medium" | "high";
  /** Detection message */
  message: string;
}

/**
 * Cost forecast result
 */
export interface ForecastResult {
  /** Forecast month (YYYY-MM) */
  targetMonth: string;
  /** Display label */
  displayLabel: string;
  /** Forecast cost (subscription-based) */
  forecastedCost: number;
  /** Actual cost (if available) */
  actualCost?: number;
  /** Variance from forecast (actual - forecast) */
  variance?: number;
  /** Variance rate (%) */
  variancePercentage?: number;
  /** Forecast breakdown by subscription */
  subscriptionBreakdown: SubscriptionForecast[];
}

/**
 * Cost forecast per subscription
 */
export interface SubscriptionForecast {
  /** Subscription ID */
  subscriptionId: string;
  /** App name */
  appName: string;
  /** Expected cost */
  expectedCost: number;
  /** Billing cycle */
  billingCycle: "MONTHLY" | "YEARLY" | "QUARTERLY";
  /** Next renewal date */
  nextRenewalDate: Date | null;
}

/**
 * Unmatched payment status
 */
export interface UnmatchedPaymentSummary {
  /** Unmatched payment count */
  count: number;
  /** Total unmatched amount */
  totalAmount: number;
  /** Most recent unmatched payment date */
  latestDate: Date | null;
}

/**
 * Server Action result types
 */
export interface GetCostStatisticsResult {
  statistics: CostStatistics;
}

export interface GetTopCostAppsResult {
  apps: AppCostDistribution[];
  totalCost: number;
}

export interface GetMonthlyCostTrendResult {
  trends: MonthlyCostTrend[];
  averageCost: number;
}

export interface DetectCostAnomaliesResult {
  anomalies: CostAnomaly[];
  hasAnomalies: boolean;
}

export interface GetForecastedCostResult {
  forecast: ForecastResult;
}
