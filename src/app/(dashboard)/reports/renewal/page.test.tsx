// src/app/(dashboard)/reports/renewal/page.test.tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RenewalReportPage from "./page";

// Mock Server Actions
vi.mock("@/actions/dashboard", () => ({
  getRenewalReportData: vi.fn().mockResolvedValue({
    within7Days: [
      {
        id: "1",
        appName: "Slack",
        renewalDate: new Date("2024-12-05"),
        amount: 150000,
        currency: "KRW",
        daysUntilRenewal: 4,
      },
    ],
    within30Days: [
      {
        id: "2",
        appName: "Notion",
        renewalDate: new Date("2024-12-20"),
        amount: 200000,
        currency: "KRW",
        daysUntilRenewal: 19,
      },
    ],
    within90Days: [
      {
        id: "3",
        appName: "Figma",
        renewalDate: new Date("2025-02-15"),
        amount: 300000,
        currency: "KRW",
        daysUntilRenewal: 75,
      },
    ],
    totalRenewalCost: 650000,
    totalCount: 3,
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

describe("RenewalReportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the page title", async () => {
    const page = await RenewalReportPage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByText("Subscription Renewal Report")).toBeInTheDocument();
  });

  it("links the back link to /reports", async () => {
    const page = await RenewalReportPage({ searchParams: Promise.resolve({}) });
    render(page);

    const backLink = screen.getByRole("link", { name: "" });
    expect(backLink).toHaveAttribute("href", "/reports");
  });

  it("shows the key metrics", async () => {
    const page = await RenewalReportPage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByText("Total Renewals")).toBeInTheDocument();
    expect(screen.getByText("Estimated Renewal Cost")).toBeInTheDocument();
    expect(screen.getByText("Within 7 Days")).toBeInTheDocument();
    expect(screen.getByText("Within 30 Days")).toBeInTheDocument();
  });

  it("shows the total renewal count", async () => {
    const page = await RenewalReportPage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows the renewals within 7 days", async () => {
    const page = await RenewalReportPage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByText("Renewals Within 7 Days")).toBeInTheDocument();
    expect(screen.getByText("Slack")).toBeInTheDocument();
  });

  it("shows the renewals in 8-30 days", async () => {
    const page = await RenewalReportPage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByText("Renewals in 8-30 Days")).toBeInTheDocument();
    expect(screen.getByText("Notion")).toBeInTheDocument();
  });

  it("shows the renewals in 31-90 days", async () => {
    const page = await RenewalReportPage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByText("Renewals in 31-90 Days")).toBeInTheDocument();
    expect(screen.getByText("Figma")).toBeInTheDocument();
  });

  it("shows the export button", async () => {
    const page = await RenewalReportPage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByTestId("export-buttons")).toBeInTheDocument();
  });
});
