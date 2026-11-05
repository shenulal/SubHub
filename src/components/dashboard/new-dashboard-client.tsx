"use client";

/**
 * NewDashboardClient (4.1 / 4.2 / 4.3 / 4.4)
 * Row 0: alert banner
 * Row 1: optimisation hero
 * Row 2: base-currency KPI bento (overview)
 * Row 3: cost trend + top apps (4.3, kept)
 * Row 4: category breakdown + upcoming renewals + seat utilisation
 * Row 5: cross-area widgets (approvals, onboarding, price changes)
 * Row 6: per-user licence + department spend + recent activity
 */
import type { DepartmentInsights } from "@/actions/department-insights";
import { ResponsiveBentoGrid, ResponsiveBentoItem } from "@/components/common";
import type {
  CategoryDistribution,
  DashboardV3Data,
  RecentActivityItem,
  SeatWidgetData,
  SubscriptionAnomalyItem,
} from "@/types/dashboard";
import type { DashboardOverview, NamedOption } from "@/types/discovery";
import { useState } from "react";

import { AppsByCategory } from "./apps-by-category";
import { BentoOptimizationHero } from "./bento-optimization-hero";
import { CategoryBreakdownChart } from "./category-breakdown-chart";
import { CostAppsTable } from "./cost-apps-table";
import { CostBarChart } from "./cost-bar-chart";
import { DashboardAlertBanner } from "./dashboard-alert-banner";
import { buildDashboardAlerts } from "./dashboard-alerts";
import { DashboardIntegrations } from "./dashboard-integrations";
import { DashboardKpiRow } from "./dashboard-kpi-row";
import { DepartmentSpendChart } from "./department-spend-chart";
import { PerUserLicenseAppsChart } from "./per-user-license-apps-chart";
import { RecentActivity } from "./recent-activity";
import { SeatUtilizationChart } from "./seat-utilization-chart";
import { UpcomingRenewals } from "./upcoming-renewals";

const DEFAULT_TREND_PERIOD = "6";

export interface NewDashboardClientProps {
  data: DashboardV3Data;
  overview: DashboardOverview | null;
  owners?: NamedOption[];
  teams?: NamedOption[];
  categoryData: CategoryDistribution[];
  recentActivities: RecentActivityItem[];
  seatWidgetData: SeatWidgetData;
  departmentSpendData: DepartmentInsights;
  hasPaymentData?: boolean;
  terminatedWithSubCount?: number;
  subscriptionAnomalies?: SubscriptionAnomalyItem[];
  suggestionCount?: number;
  isReadOnly?: boolean;
}

export function NewDashboardClient({
  data,
  overview,
  owners = [],
  teams = [],
  categoryData,
  recentActivities,
  seatWidgetData,
  departmentSpendData,
  hasPaymentData: hasPayment,
  terminatedWithSubCount,
  subscriptionAnomalies = [],
  suggestionCount = 0,
  isReadOnly = false,
}: NewDashboardClientProps) {
  const [period, setPeriod] = useState<string>(DEFAULT_TREND_PERIOD);
  const isPersonal = overview?.scope === "personal";
  const alerts = buildDashboardAlerts({
    hasPaymentData: hasPayment,
    terminatedWithSubCount,
    suggestionCount,
    subscriptionAnomalies,
  });

  const baseCurrency = overview?.baseCurrency;
  // Three-card rows (12-col bento): stacked → 2 + full-width third (md/lg)
  // → 3 equal columns from xl. Every card in a row shares one fixed height.
  const pairSpan = { cols: 1, colsSm: 6, colsMd: 4, colsLg: 6 };
  const lastSpan = { cols: 1, colsSm: 6, colsMd: 8, colsLg: 12 };
  const tripleXl = "min-w-0 xl:col-span-4";

  return (
    <div
      className="@container space-y-6"
      data-testid="dashboard"
      data-scope={overview?.scope ?? "workspace"}
    >
      {!isReadOnly && !isPersonal && alerts.length > 0 && (
        <DashboardAlertBanner alerts={alerts} />
      )}

      {!isPersonal && (
        <BentoOptimizationHero
          data={data.hero}
          isReadOnly={isReadOnly}
          currency={baseCurrency}
        />
      )}

      {overview && (
        <DashboardKpiRow
          kpis={overview.kpis}
          baseCurrency={overview.baseCurrency}
          hasStaleRates={overview.hasStaleRates}
          showApprovals={!isPersonal}
        />
      )}

      <ResponsiveBentoGrid gap="lg">
        <ResponsiveBentoItem {...lastSpan} className="min-w-0 xl:col-span-6">
          <CostBarChart
            data={data.costTrend}
            period={period}
            onPeriodChange={setPeriod}
            currency={baseCurrency}
          />
        </ResponsiveBentoItem>
        <ResponsiveBentoItem {...lastSpan} className="min-w-0 xl:col-span-6">
          <CostAppsTable
            initialData={data.topApps}
            period={period}
            onPeriodChange={setPeriod}
            currency={baseCurrency}
          />
        </ResponsiveBentoItem>
      </ResponsiveBentoGrid>

      <ResponsiveBentoGrid gap="lg">
        <ResponsiveBentoItem {...pairSpan} className={tripleXl}>
          {overview ? (
            <CategoryBreakdownChart
              initialData={overview.categorySpend}
              baseCurrency={overview.baseCurrency}
              owners={owners}
              teams={teams}
              showFilters={!isPersonal}
            />
          ) : (
            <AppsByCategory data={categoryData} />
          )}
        </ResponsiveBentoItem>
        <ResponsiveBentoItem {...pairSpan} className={tripleXl}>
          <UpcomingRenewals
            data={data.renewals}
            overviewRenewals={overview?.upcomingRenewals}
            baseCurrency={overview?.baseCurrency}
            windowDays={overview?.kpis.renewingSoonDays}
          />
        </ResponsiveBentoItem>
        <ResponsiveBentoItem {...lastSpan} className={tripleXl}>
          <SeatUtilizationChart data={seatWidgetData.lowUtilizationApps} />
        </ResponsiveBentoItem>
      </ResponsiveBentoGrid>

      <DashboardIntegrations isPersonal={isPersonal} />

      <ResponsiveBentoGrid gap="lg">
        <ResponsiveBentoItem {...pairSpan} className={tripleXl}>
          <PerUserLicenseAppsChart data={seatWidgetData.topLicenseApps} />
        </ResponsiveBentoItem>
        {!isPersonal && (
          <ResponsiveBentoItem {...pairSpan} className={tripleXl}>
            <DepartmentSpendChart
              data={departmentSpendData}
              currency={baseCurrency}
            />
          </ResponsiveBentoItem>
        )}
        <ResponsiveBentoItem
          {...(isPersonal ? pairSpan : lastSpan)}
          className={isPersonal ? "min-w-0" : tripleXl}
        >
          <RecentActivity activities={recentActivities} />
        </ResponsiveBentoItem>
      </ResponsiveBentoGrid>
    </div>
  );
}
