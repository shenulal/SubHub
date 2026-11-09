// src/types/platform-analytics.ts
/**
 * Control Panel analytics (super admin): platform-wide and per-organisation
 * aggregates. Money values are monthly-equivalent amounts already converted to
 * `currency` (platform base for the platform view, the organisation's base for
 * the organisation view). Dates are ISO strings.
 */

export interface PeriodOption {
  token: string;
  label: string;
}

export interface AnalyticsPeriodInfo {
  token: string;
  label: string;
  since: string;
  until: string;
  /** UTC month keys "YYYY-MM", oldest first, current month last. */
  months: string[];
  options: PeriodOption[];
}

export interface GrowthPoint {
  month: string;
  organizations: number;
  users: number;
  subscriptions: number;
}

export interface SpendPoint {
  month: string;
  monthly: number;
}

export interface SpendSlice {
  key: string;
  label: string;
  monthly: number;
  count: number;
}

export interface TopApp {
  key: string;
  name: string;
  logoUrl: string | null;
  organizations: number;
  subscriptions: number;
  monthly: number;
}

export type OrganizationStatus = "active" | "suspended";

export interface OrganizationComparisonRow {
  id: string;
  name: string;
  status: OrganizationStatus;
  users: number;
  activeUsers: number;
  signedInUsers: number;
  activeSubscriptions: number;
  monthlySpend: number;
  pendingApprovals: number;
  renewalsDue: number;
  lastActivityAt: string | null;
}

export interface AnalyticsContext {
  currency: string;
  hasStaleRates: boolean;
  period: AnalyticsPeriodInfo;
  renewalWindowDays: number;
  generatedAt: string;
}

export interface PlatformKpis {
  organizations: number;
  activeOrganizations: number;
  suspendedOrganizations: number;
  users: number;
  activeUsers: number;
  signedInUsers: number;
  activeSubscriptions: number;
  monthlySpend: number;
  annualRunRate: number;
  renewalsDue: number;
  pendingApprovals: number;
}

export interface PlatformAnalytics extends AnalyticsContext {
  kpis: PlatformKpis;
  growth: GrowthPoint[];
  spendTrend: SpendPoint[];
  spendByCategory: SpendSlice[];
  topAppsBySpend: TopApp[];
  topAppsByAdoption: TopApp[];
  organizations: OrganizationComparisonRow[];
}

export interface OrganizationKpis {
  users: number;
  activeUsers: number;
  signedInUsers: number;
  activeSubscriptions: number;
  monthlySpend: number;
  annualRunRate: number;
  renewalsDue: number;
  pendingApprovals: number;
  apps: number;
  teams: number;
}

export interface CountSlice {
  key: string;
  label: string;
  count: number;
}

export interface ApprovalsSummary {
  pending: number;
  submitted: number;
  approved: number;
  rejected: number;
  /** Mean submitted → decided time for decisions in the period (hours). */
  avgDecisionHours: number | null;
}

export interface SignInPoint {
  month: string;
  signIns: number;
  users: number;
}

export interface OrganizationAnalytics extends AnalyticsContext {
  organization: {
    id: string;
    name: string;
    status: OrganizationStatus;
    createdAt: string;
    lastActivityAt: string | null;
  };
  kpis: OrganizationKpis;
  growth: GrowthPoint[];
  spendTrend: SpendPoint[];
  spendByCategory: SpendSlice[];
  spendByTeam: SpendSlice[];
  spendByCostCentre: SpendSlice[];
  topApps: TopApp[];
  subscriptionsByStatus: CountSlice[];
  usersByRole: CountSlice[];
  approvals: ApprovalsSummary;
  signIns: SignInPoint[];
}
