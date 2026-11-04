// src/app/(dashboard)/dashboard/page.tsx
import {
  getCostAnomalies,
  getCostStatistics,
  getMonthlyCostTrend,
  getTopCostApps,
} from "@/actions/cost-analytics";
import {
  getAppsByCategory,
  getAppsWithoutSubscriptions,
  getDashboardStats,
  getPendingOnboardingCount,
  getRecentActivity,
  getSubscriptionAnomalies,
  getTerminatedUsersCount,
  getTerminatedUsersSubAssignmentCount,
  getTerminatedUsersWithSubCount,
  getUpcomingRenewals,
} from "@/actions/dashboard";
import { getSeatWidgetData } from "@/actions/dashboard2-seat";
import { getDepartmentInsights } from "@/actions/department-insights";
import { getDashboardOverview } from "@/actions/discovery/dashboard-overview";
import { getSubscriptionFilterOptions } from "@/actions/discovery/list";
import { getWorkspaceScope } from "@/actions/discovery/scope";
import { hasPaymentData } from "@/actions/payments";
import { getSeatWasteAnalysis } from "@/actions/seat-waste-analysis";
import { getSuggestionCount } from "@/actions/subscriptions/subscription-suggestions";
import { getUnusedApps } from "@/actions/unused-apps";
import { NewDashboardClient } from "@/components/dashboard";
import { requireOrganization } from "@/lib/auth/require-auth";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import type { Metadata } from "next";

import { transformToDashboardV3Data } from "./transforms";

export const metadata: Metadata = { title: "Dashboard" };

const TOP_APPS_LIMIT = 10;
const TREND_MONTHS = 12;

export default async function DashboardPage() {
  await requirePermissionOrRedirect("reports:read", "/subscriptions");
  const { role, userId, teamId } = await requireOrganization();
  const isMember = role === "MEMBER";
  const { scope } = await getWorkspaceScope();

  // Batch 1: overview (base currency, scope-aware) + legacy core data.
  const [
    overviewRes,
    filterOptionsRes,
    stats,
    costStatsRes,
    topAppsRes,
    monthlyTrendRes,
    anomaliesRes,
  ] = await Promise.all([
    getDashboardOverview(scope),
    getSubscriptionFilterOptions(),
    getDashboardStats(),
    getCostStatistics({}),
    getTopCostApps({ limit: TOP_APPS_LIMIT }),
    getMonthlyCostTrend({ months: TREND_MONTHS }),
    getCostAnomalies(),
  ]);

  // Batch 2: widgets kept from the previous dashboard (4.3 cost trend, seats, departments).
  const [
    renewals,
    terminatedCount,
    appsWithoutSubData,
    categoryData,
    recentActivities,
    seatWasteAnalysisRes,
    unusedAppsRes,
    seatWidgetData,
    departmentInsights,
    hasPaymentDataRes,
    terminatedWithSubCount,
    subscriptionAnomalies,
    terminatedSubAssignmentCount,
    _pendingOnboardingCount,
    suggestionCountRes,
  ] = await Promise.all([
    getUpcomingRenewals(isMember ? { teamId } : {}),
    getTerminatedUsersCount(),
    getAppsWithoutSubscriptions(),
    getAppsByCategory(),
    getRecentActivity(isMember ? { userId } : {}),
    getSeatWasteAnalysis(),
    getUnusedApps(),
    getSeatWidgetData(),
    getDepartmentInsights(),
    hasPaymentData(),
    getTerminatedUsersWithSubCount(),
    getSubscriptionAnomalies(),
    getTerminatedUsersSubAssignmentCount(),
    getPendingOnboardingCount(),
    getSuggestionCount(),
  ]);

  const costStats = costStatsRes.success
    ? (costStatsRes.data?.statistics ?? null)
    : null;
  const topApps = topAppsRes.success ? (topAppsRes.data?.apps ?? []) : [];
  const monthlyTrend = monthlyTrendRes.success
    ? (monthlyTrendRes.data?.trends ?? [])
    : [];
  const anomalyData = anomaliesRes.success ? (anomaliesRes.data ?? null) : null;
  const seatWasteData = seatWasteAnalysisRes.success
    ? (seatWasteAnalysisRes.data ?? null)
    : null;
  const unusedAppsData = unusedAppsRes.success
    ? (unusedAppsRes.data ?? null)
    : null;
  const hasPayment = hasPaymentDataRes.success
    ? hasPaymentDataRes.data?.hasData
    : undefined;
  const suggestionCount = suggestionCountRes.success
    ? (suggestionCountRes.data?.count ?? 0)
    : 0;

  const dashboardData = transformToDashboardV3Data(
    stats,
    costStats,
    topApps,
    monthlyTrend,
    renewals,
    terminatedCount,
    anomalyData,
    appsWithoutSubData,
    seatWasteData,
    unusedAppsData,
    terminatedWithSubCount,
    terminatedSubAssignmentCount
  );

  const filterOptions = filterOptionsRes.success
    ? filterOptionsRes.data
    : undefined;

  return (
    <div className="flex flex-1 flex-col">
      <NewDashboardClient
        data={dashboardData}
        overview={overviewRes.success ? (overviewRes.data ?? null) : null}
        owners={filterOptions?.owners ?? []}
        teams={filterOptions?.teams ?? []}
        categoryData={categoryData}
        recentActivities={recentActivities}
        seatWidgetData={seatWidgetData}
        departmentSpendData={departmentInsights}
        hasPaymentData={hasPayment}
        terminatedWithSubCount={terminatedWithSubCount}
        subscriptionAnomalies={subscriptionAnomalies}
        suggestionCount={suggestionCount}
        isReadOnly={isMember}
      />
    </div>
  );
}
