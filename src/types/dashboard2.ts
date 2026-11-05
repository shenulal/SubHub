// src/types/dashboard2.ts

import { AppSource, AppStatus } from "@prisma/client";
import type {
  LicenseUsageTrend,
  LowUtilizationApp,
  SeatWidgetData,
  TopLicenseApp,
} from "./dashboard";

// Seat/License types are re-exported from @/types/dashboard
export type {
  LicenseUsageTrend,
  LowUtilizationApp,
  SeatWidgetData,
  TopLicenseApp,
};

/**
 * Shadow IT list item
 */
export interface ShadowITItem {
  id: string;
  appId: string;
  appName: string;
  appLogo?: string | null;
  source: AppSource;
  status: AppStatus;
  estimatedCost?: number | null;
  discoveredAt: Date;
  userCount?: number;
  isAI?: boolean; // whether it is Shadow AI
  category?: string | null;
}

/**
 * App status distribution (for the donut chart)
 */
export interface AppStatusDistribution {
  active: number;
  inactive: number;
  blocked: number;
  total: number;
}

/**
 * Security risk gauge data
 */
export interface SecurityRiskGauge {
  riskScore: number; // 0-100
  forRisk: number; // For Review count
  highRisk: number; // High Risk count
  unapproved: number; // Unapproved count
}

/**
 * Security alert item
 */
export interface SecurityAlertItem {
  type: "shadow_ai" | "high_risk" | "unapproved";
  icon: "warning" | "alert" | "info";
  message: string;
  appName?: string;
  score?: number;
}

/**
 * Spend by category (for the stacked bar + progress list)
 */
export interface SpendByCategory {
  category: string;
  amount: number;
  percentage: number;
  subscriptionCount?: number; // subscription count in this category
  changeRate?: number; // month-over-month change (%)
}

/**
 * Urgent renewal summary
 */
export interface UrgentRenewalSummary {
  thirtyDayCount: number;
  thirtyDayAmount: number;
  fifteenDayCount: number;
  fifteenDayAmount: number;
  sevenDayCount: number;
  sevenDayAmount: number;
  criticalApp?: {
    name: string;
    renewalDate: Date;
  } | null;
}

/**
 * Onboarding/offboarding user
 */
export interface OnboardingOffboardingUser {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  department: string;
  startDate?: Date;
  endDate?: Date;
  status: "pending" | "in_progress" | "completed";
  progress: number;
}

/**
 * Onboarding/offboarding summary
 */
export interface OnboardingOffboardingSummary {
  onboarding: {
    count: number;
    users: OnboardingOffboardingUser[];
  };
  offboarding: {
    count: number;
    users: OnboardingOffboardingUser[];
  };
}

/**
 * Top spending app (for the table)
 */
export interface TopSpendingApp {
  id: string;
  name: string;
  logo?: string | null;
  userCount: number;
  monthlyCost: number;
  totalLicenses?: number;
  unusedRate?: number; // unused rate (%)
}

/**
 * Platform details
 */
export interface PlatformDetail {
  platform: "MACOS" | "WINDOWS" | "LINUX" | "OTHER";
  osVersion?: string | null; // e.g. "14.0", "10.0.19045", "Ubuntu 22.04"
  deviceCount: number; // number of devices on this platform
}

/**
 * Device-detected app (collected from FleetDM)
 */
export interface DeviceDetectedApp {
  id: string;
  name: string;
  version?: string | null;
  deviceCount: number; // number of devices it is installed on
  approvalStatus: "UNKNOWN" | "APPROVED" | "SHADOW_IT" | "BLOCKED";
  platforms: string[]; // installed OS platforms (MACOS, WINDOWS, LINUX, OTHER) - backward compatibility
  platformDetails: PlatformDetail[]; // per-platform details (including OS version)
  matchedApp?: {
    id: string;
    name: string;
  } | null;
  isOsDefault: boolean; // whether it is an OS default app
}

/**
 * Device-detected app statistics (OS default apps separated)
 */
export interface DeviceDetectedAppsStats {
  total: number;
  osDefault: {
    count: number;
    totalDevices: number;
  };
  userInstalled: {
    count: number;
    totalDevices: number;
  };
  byApprovalStatus: {
    approved: number;
    shadowIt: number;
    blocked: number;
    unknown: number;
  };
}

/**
 * OS default app record (DB type)
 */
export interface OsDefaultAppRecord {
  id: string;
  name: string;
  bundleId: string | null;
  namePattern: string | null;
  platform: "MACOS" | "WINDOWS" | "LINUX" | "IOS" | "ANDROID" | "OTHER";
  category: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * OS default app create input
 */
export interface CreateOsDefaultAppInput {
  name: string;
  bundleId?: string;
  namePattern?: string;
  platform: "MACOS" | "WINDOWS" | "LINUX";
  category?: string;
  description?: string;
}

/**
 * Summary of unrevoked accounts of departed employees
 */
export interface UnrecoveredAccountsSummary {
  totalCount: number;
  users: {
    id: string;
    name: string;
    email: string;
    terminatedAt: Date;
    unrecoveredApps: number;
  }[];
}

/**
 * Dashboard2 overall summary data
 */
export interface Dashboard2Summary {
  // Row 1: KPI Cards
  onboardingOffboarding: OnboardingOffboardingSummary;
  totalMonthlySpend: {
    amount: number;
    changeRate: number;
    budgetRatio?: number; // ratio to budget (%)
  };
  securityRisks: {
    unapproved: number;
    shadowAI: number;
  };
  totalActiveUsers: {
    count: number;
    licenseUtilization: number;
  };
  urgentRenewals: UrgentRenewalSummary;
  unrecoveredAccounts: UnrecoveredAccountsSummary;

  // Row 2: Charts
  monthlySpendTrend: {
    month: string;
    saasCost: number;
    nonSaasCost: number;
    isCurrentMonth: boolean; // whether this is the current (in-progress) month
  }[];
  licenseUsageTrend: LicenseUsageTrend[];

  // Row 3: Analysis Cards
  spendByCategory: SpendByCategory[];
  appStatusDistribution: AppStatusDistribution;
  securityRiskOverview: {
    gauge: SecurityRiskGauge;
    alerts: SecurityAlertItem[];
  };

  // Row 4: Tables
  recentShadowIT: ShadowITItem[];
  topSpendingApps: TopSpendingApp[];
  deviceDetectedApps: DeviceDetectedApp[];
}
