// src/app/(dashboard)/reports/cost-analysis/page.test.tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CostAnalysisPage from "./page";

// Mock Server Actions
vi.mock("@/actions/cost-analytics", () => ({
  getCostStatistics: vi.fn().mockResolvedValue({
    success: true,
    data: {
      statistics: {
        totalCost: 1500000,
        monthlyAverage: 500000,
        costChange: 15.5,
        transactionCount: 25,
        currency: "KRW",
        periodStart: new Date("2024-11-01"),
        periodEnd: new Date("2024-11-30"),
      },
    },
  }),
  getMonthlyCostTrend: vi.fn().mockResolvedValue({
    success: true,
    data: {
      trends: [
        {
          month: "2024-06",
          displayLabel: "Jun 2024",
          totalCost: 400000,
          transactionCount: 5,
        },
        {
          month: "2024-07",
          displayLabel: "Jul 2024",
          totalCost: 450000,
          transactionCount: 6,
        },
        {
          month: "2024-08",
          displayLabel: "Aug 2024",
          totalCost: 480000,
          transactionCount: 7,
        },
      ],
      averageCost: 443333,
    },
  }),
  getTopCostApps: vi.fn().mockResolvedValue({
    success: true,
    data: {
      apps: [
        {
          appId: "1",
          appName: "Slack",
          totalCost: 500000,
          percentage: 33.3,
          transactionCount: 10,
        },
        {
          appId: "2",
          appName: "Notion",
          totalCost: 300000,
          percentage: 20.0,
          transactionCount: 8,
        },
      ],
      totalCost: 1500000,
    },
  }),
  detectCostAnomalies: vi.fn().mockResolvedValue({
    success: true,
    data: {
      anomalies: [
        {
          appId: "3",
          appName: "Figma",
          currentCost: 200000,
          previousCost: 100000,
          changeRate: 100,
          severity: "medium" as const,
          message: "Up 100% vs last month",
        },
      ],
      hasAnomalies: true,
    },
  }),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// Mock ExportButtons
vi.mock("./_components/export-buttons", () => ({
  ExportButtons: () => <div data-testid="export-buttons">Export Buttons</div>,
}));

// Chart components depend on resize/ResponsiveContainer, so they are mocked simply in tests
vi.mock("./_components/monthly-trend-chart", () => ({
  MonthlyTrendChart: ({
    initialData,
  }: {
    initialData: { displayLabel: string }[];
  }) => (
    <div data-testid="monthly-trend-chart">
      <div>Monthly Cost Trend</div>
      {initialData.map((item) => (
        <div key={item.displayLabel}>{item.displayLabel}</div>
      ))}
    </div>
  ),
}));

describe("CostAnalysisPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the page title", async () => {
    const page = await CostAnalysisPage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByText("Cost Analysis Report")).toBeInTheDocument();
  });

  it("links the back link to /reports", async () => {
    const page = await CostAnalysisPage({ searchParams: Promise.resolve({}) });
    render(page);

    const backLink = screen.getByRole("link", { name: "" });
    expect(backLink).toHaveAttribute("href", "/reports");
  });

  it("shows the key metrics", async () => {
    const page = await CostAnalysisPage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByText("This Month's SaaS Cost")).toBeInTheDocument();
    expect(screen.getByText("Monthly SaaS Average")).toBeInTheDocument();
    expect(screen.getByText("Transactions")).toBeInTheDocument();
    expect(screen.getByText("Anomaly Detection")).toBeInTheDocument();
  });

  it("shows the monthly cost trend section", async () => {
    const page = await CostAnalysisPage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByText("Monthly Cost Trend")).toBeInTheDocument();
    expect(screen.getByText("Jun 2024")).toBeInTheDocument();
    expect(screen.getByText("Jul 2024")).toBeInTheDocument();
  });

  it("shows the cost distribution by app", async () => {
    const page = await CostAnalysisPage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByText("Cost Distribution by App")).toBeInTheDocument();
    expect(screen.getByText("Slack")).toBeInTheDocument();
    expect(screen.getByText("Notion")).toBeInTheDocument();
  });

  it("shows the cost anomaly detection section", async () => {
    const page = await CostAnalysisPage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByText("Cost Anomaly Detection")).toBeInTheDocument();
    expect(screen.getByText("Figma")).toBeInTheDocument();
    expect(screen.getByText("+100%")).toBeInTheDocument();
  });

  it("shows the export buttons", async () => {
    const page = await CostAnalysisPage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByTestId("export-buttons")).toBeInTheDocument();
  });
});
