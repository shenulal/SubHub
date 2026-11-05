// src/types/dashboard.ts
// Consolidated dashboard types (Phase 4: merged dashboard-v3.ts + dashboard2 Seat types)

// ─── Base dashboard types ───

/**
 * Dashboard statistics
 */
export interface DashboardStats {
  totalApps: number;
  activeSubscriptions: number;
  totalUsers: number;
  totalMonthlyCost: number;
  currency: string;
}

/**
 * Upcoming subscription renewal
 */
export interface UpcomingRenewal {
  id: string;
  appName: string;
  appLogoUrl?: string;
  renewalDate: Date;
  amount: number;
  currency: string;
  daysUntilRenewal: number;
  teamId?: string | null;
  teamName?: string | null;
  assignedUsers?: Array<{
    id: string;
    name: string | null;
    email: string;
  }>;
}

/**
 * App distribution by category
 */
export interface CategoryDistribution {
  category: string;
  count: number;
  percentage: number;
}

/**
 * Recent activity item
 */
export interface RecentActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  userName?: string;
  userEmail?: string;
  createdAt: Date;
  description: string;
}

/**
 * Renewal list data for reports
 */
export interface RenewalReportData {
  within7Days: UpcomingRenewal[];
  within30Days: UpcomingRenewal[];
  within90Days: UpcomingRenewal[];
  totalRenewalCost: number;
  totalCount: number;
}

// ─── V3 dashboard layout types (formerly dashboard-v3.ts) ───

/**
 * OptimizationHero component data
 */
export interface OptimizationHeroData {
  monthlySavings: number;
  annualSavings: number;
  vsLastMonth: number;
  breakdown: {
    unusedLicenses: { amount: number; count: number };
    duplicateSubs: { amount: number; count: number };
    unusedApps: { amount: number; count: number };
  };
}

/**
 * UpcomingRenewals component item type
 */
export interface RenewalItem {
  id: string;
  appName: string;
  logoUrl?: string;
  renewalCost: number;
  daysUntilRenewal: number;
  urgency: "urgent" | "moderate" | "safe";
}

/**
 * Total Cost KPI Card Props
 */
export interface TotalCostKpiData {
  amount: number;
  changePercent: number;
  note?: string;
}

/**
 * Anomaly Detection KPI Card Props
 */
export interface AnomalyKpiData {
  count: number;
  severity: "low" | "medium" | "high";
}

/**
 * Terminated Users KPI Card Props
 */
export interface TerminatedKpiData {
  count: number;
  appCount: number;
}

/**
 * Apps Without Subscription KPI Card Props
 */
export interface AppsWithoutSubKpiData {
  count: number;
  totalActiveApps: number;
}

/**
 * MonthlyBarData for CostBarChart component
 */
export interface MonthlyBarData {
  month: string;
  displayLabel: string;
  saasCost: number;
  nonSaasCost: number;
  isCurrentMonth?: boolean;
}

/**
 * CostAppData for CostAppsTable component
 */
export interface CostAppData {
  id: string;
  name: string;
  logoUrl?: string;
  monthlyCost: number;
  usedLicenses: number;
  totalLicenses: number;
  usageEfficiency: number;
  grade: "A" | "B" | "C" | "D";
  hasSeatData: boolean;
}

/**
 * Subscription Anomaly Item
 */
export interface SubscriptionAnomalyItem {
  subscriptionId: string;
  appName: string;
  billingType: "FLAT_RATE" | "PER_SEAT";
  totalLicenses?: number;
  usedLicenses?: number;
  savableAmount?: number;
}

/**
 * Dashboard V3 Client Component Props
 */
export interface DashboardV3Data {
  hero: OptimizationHeroData;
  kpi: {
    totalCost: TotalCostKpiData;
    anomaly: AnomalyKpiData;
    terminated: TerminatedKpiData;
    appsWithoutSub: AppsWithoutSubKpiData;
  };
  costTrend: MonthlyBarData[];
  topApps: CostAppData[];
  renewals: RenewalItem[];
}

// ─── Seat/License types (moved from dashboard2.ts) ───

/**
 * Monthly seat assignment trend
 */
export interface LicenseUsageTrend {
  month: string;
  totalSeats: number;
  assignedSeats: number;
  unassignedSeats: number;
}

/**
 * Apps with the lowest seat utilisation
 */
export interface LowUtilizationApp {
  appId: string;
  appName: string;
  totalSeats: number;
  assignedSeats: number;
  utilizationRate: number;
}

/**
 * Individually licensed apps (top)
 */
export interface TopLicenseApp {
  appId: string;
  appName: string;
  appLogo?: string;
  userCount: number;
  usageCount?: number;
}

/**
 * Seat widget data
 */
export interface SeatWidgetData {
  lowUtilizationApps: LowUtilizationApp[];
  topLicenseApps: TopLicenseApp[];
}
