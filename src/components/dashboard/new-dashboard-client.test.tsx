// src/components/dashboard/new-dashboard-client.test.tsx
// Renders the restructured dashboard (overview KPI row, category breakdown,
// cross-area widgets, personal-mode behaviour) with every child mocked.

import type { DashboardV3Data } from "@/types/dashboard";
import type { DashboardOverview } from "@/types/discovery";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./bento-optimization-hero", () => ({
  BentoOptimizationHero: ({ isReadOnly }: { isReadOnly?: boolean }) => (
    <div data-testid="bento-optimization-hero" data-readonly={isReadOnly}>
      OptimizationHero
    </div>
  ),
}));
vi.mock("./dashboard-kpi-row", () => ({
  DashboardKpiRow: ({
    showApprovals,
    baseCurrency,
  }: {
    showApprovals: boolean;
    baseCurrency: string;
  }) => (
    <div
      data-testid="dashboard-kpi-row"
      data-approvals={showApprovals}
      data-currency={baseCurrency}
    >
      Kpis
    </div>
  ),
}));
vi.mock("./category-breakdown-chart", () => ({
  CategoryBreakdownChart: ({ showFilters }: { showFilters: boolean }) => (
    <div data-testid="category-breakdown" data-filters={showFilters}>
      Categories
    </div>
  ),
}));
vi.mock("./dashboard-integrations", () => ({
  DashboardIntegrations: ({ isPersonal }: { isPersonal: boolean }) => (
    <div data-testid="dashboard-integrations" data-personal={isPersonal}>
      Integrations
    </div>
  ),
}));
vi.mock("./cost-bar-chart", () => ({
  CostBarChart: () => (
    <div data-testid="bento-cost-bar-chart">CostBarChart</div>
  ),
}));
vi.mock("./cost-apps-table", () => ({
  CostAppsTable: () => (
    <div data-testid="bento-cost-apps-table">CostAppsTable</div>
  ),
}));
vi.mock("./seat-utilization-chart", () => ({
  SeatUtilizationChart: () => (
    <div data-testid="bento-seat-utilization">SeatUtilization</div>
  ),
}));
vi.mock("./per-user-license-apps-chart", () => ({
  PerUserLicenseAppsChart: () => (
    <div data-testid="bento-per-user-license">PerUserLicense</div>
  ),
}));
vi.mock("./upcoming-renewals", () => ({
  UpcomingRenewals: ({ windowDays }: { windowDays?: number }) => (
    <div data-testid="bento-upcoming-renewals" data-window={windowDays}>
      UpcomingRenewals
    </div>
  ),
}));
vi.mock("./apps-by-category", () => ({
  AppsByCategory: () => (
    <div data-testid="bento-apps-by-category">AppsByCategory</div>
  ),
}));
vi.mock("./department-spend-chart", () => ({
  DepartmentSpendChart: () => (
    <div data-testid="bento-department-spend">DepartmentSpend</div>
  ),
}));
vi.mock("./recent-activity", () => ({
  RecentActivity: () => (
    <div data-testid="bento-recent-activity">RecentActivity</div>
  ),
}));
vi.mock("./dashboard-alert-banner", () => ({
  DashboardAlertBanner: ({ alerts }: { alerts: unknown[] }) => (
    <div data-testid="dashboard-alert-banner" data-alert-count={alerts.length}>
      AlertBanner
    </div>
  ),
}));
vi.mock("@/components/common", () => ({
  ResponsiveBentoGrid: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bento-grid">{children}</div>
  ),
  ResponsiveBentoItem: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bento-item">{children}</div>
  ),
}));

import { NewDashboardClient } from "./new-dashboard-client";

const mockDashboardV3Data: DashboardV3Data = {
  hero: {
    monthlySavings: 1500000,
    annualSavings: 18000000,
    vsLastMonth: -5.2,
    breakdown: {
      unusedLicenses: { amount: 500000, count: 3 },
      duplicateSubs: { amount: 700000, count: 2 },
      unusedApps: { amount: 300000, count: 1 },
    },
  },
  kpi: {
    totalCost: { amount: 50000000, changePercent: 3.5 },
    anomaly: { count: 2, severity: "medium" },
    terminated: { count: 5, appCount: 12 },
    appsWithoutSub: { count: 3, totalActiveApps: 25 },
  },
  costTrend: [
    {
      month: "2026-01",
      displayLabel: "1월",
      saasCost: 3000000,
      nonSaasCost: 500000,
    },
  ],
  topApps: [],
  renewals: [
    {
      id: "r-1",
      appName: "Notion",
      renewalCost: 5000000,
      daysUntilRenewal: 15,
      urgency: "moderate",
    },
  ],
};

const overview: DashboardOverview = {
  scope: "workspace",
  baseCurrency: "AED",
  hasStaleRates: false,
  generatedAt: "2026-11-04T00:00:00.000Z",
  kpis: {
    monthlySpendBase: 1000,
    annualRunRateBase: 12000,
    activeCount: 4,
    renewingSoonCount: 2,
    renewingSoonDays: 30,
    pendingApprovalsCount: 1,
    pendingApprovalsMonthlyBase: 50,
  },
  upcomingRenewals: [],
  categorySpend: [],
};

const defaultProps = {
  data: mockDashboardV3Data,
  overview,
  categoryData: [{ category: "Collaboration", count: 5, percentage: 50 }],
  recentActivities: [],
  seatWidgetData: { lowUtilizationApps: [], topLicenseApps: [] },
  departmentSpendData: {
    departments: [],
    totalSpend: 0,
    avgSpendPerDept: 0,
    totalDepartments: 0,
    topApps: [],
  },
};

describe("NewDashboardClient", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders every row of the restructured layout in workspace mode", () => {
    render(<NewDashboardClient {...defaultProps} />);
    for (const id of [
      "bento-optimization-hero",
      "dashboard-kpi-row",
      "bento-cost-bar-chart",
      "bento-cost-apps-table",
      "category-breakdown",
      "bento-upcoming-renewals",
      "bento-seat-utilization",
      "dashboard-integrations",
      "bento-per-user-license",
      "bento-department-spend",
      "bento-recent-activity",
    ]) {
      expect(screen.getByTestId(id), id).toBeInTheDocument();
    }
    expect(screen.getByTestId("dashboard")).toHaveAttribute(
      "data-scope",
      "workspace"
    );
    expect(screen.getByTestId("dashboard-kpi-row")).toHaveAttribute(
      "data-approvals",
      "true"
    );
    expect(screen.getByTestId("dashboard-kpi-row")).toHaveAttribute(
      "data-currency",
      "AED"
    );
    expect(screen.getByTestId("bento-upcoming-renewals")).toHaveAttribute(
      "data-window",
      "30"
    );
    expect(screen.getAllByTestId("bento-grid")).toHaveLength(3);
    expect(screen.getAllByTestId("bento-item")).toHaveLength(8);
    expect(
      screen.queryByTestId("bento-apps-by-category")
    ).not.toBeInTheDocument();
  });

  it("falls back to the legacy category widget without an overview", () => {
    render(<NewDashboardClient {...defaultProps} overview={null} />);
    expect(screen.queryByTestId("dashboard-kpi-row")).not.toBeInTheDocument();
    expect(screen.getByTestId("bento-apps-by-category")).toBeInTheDocument();
  });

  it("hides team and approval widgets in personal mode", () => {
    render(
      <NewDashboardClient
        {...defaultProps}
        overview={{ ...overview, scope: "personal" }}
        hasPaymentData={false}
      />
    );
    expect(screen.getByTestId("dashboard")).toHaveAttribute(
      "data-scope",
      "personal"
    );
    expect(
      screen.queryByTestId("bento-optimization-hero")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("dashboard-alert-banner")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("bento-department-spend")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("dashboard-kpi-row")).toHaveAttribute(
      "data-approvals",
      "false"
    );
    expect(screen.getByTestId("category-breakdown")).toHaveAttribute(
      "data-filters",
      "false"
    );
    expect(screen.getByTestId("dashboard-integrations")).toHaveAttribute(
      "data-personal",
      "true"
    );
  });

  describe("alert banner", () => {
    it("shows alerts for missing payment data, offboarded users, suggestions and anomalies", () => {
      render(
        <NewDashboardClient
          {...defaultProps}
          hasPaymentData={false}
          terminatedWithSubCount={3}
          suggestionCount={5}
          subscriptionAnomalies={[
            {
              subscriptionId: "sub-1",
              appName: "Slack",
              billingType: "FLAT_RATE",
            },
            {
              subscriptionId: "sub-2",
              appName: "Notion",
              billingType: "PER_SEAT",
              usedLicenses: 5,
              totalLicenses: 20,
            },
          ]}
        />
      );
      expect(screen.getByTestId("dashboard-alert-banner")).toHaveAttribute(
        "data-alert-count",
        "5"
      );
    });

    it("hides the banner without alerts and for read-only members", () => {
      const { rerender } = render(
        <NewDashboardClient {...defaultProps} hasPaymentData={true} />
      );
      expect(
        screen.queryByTestId("dashboard-alert-banner")
      ).not.toBeInTheDocument();
      rerender(
        <NewDashboardClient
          {...defaultProps}
          hasPaymentData={false}
          isReadOnly
        />
      );
      expect(
        screen.queryByTestId("dashboard-alert-banner")
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("bento-optimization-hero")).toHaveAttribute(
        "data-readonly",
        "true"
      );
    });
  });
});
