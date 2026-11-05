// src/components/dashboard/apps-by-category.test.tsx
import messages from "@/i18n/messages/en.json";
import type { CategoryDistribution } from "@/types/dashboard";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// next-intl mock (used instead of the Provider to avoid dual-React issues)
vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getNestedValue(obj: any, path: string): string | undefined {
    return path.split(".").reduce((acc, key) => acc?.[key], obj);
  }

  return {
    useTranslations: () => {
      const t = (key: string, values?: Record<string, string | number>) => {
        const value = getNestedValue(messages, key);
        if (!value || typeof value !== "string") return key;
        if (!values) return value;
        return Object.entries(values).reduce(
          (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
          value
        );
      };
      return t;
    },
    NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
      children,
  };
});

// Recharts mock (avoids ResponsiveContainer issues)
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

import { AppsByCategory } from "./apps-by-category";

describe("AppsByCategory", () => {
  const mockData: CategoryDistribution[] = [
    { category: "Collaboration", count: 5, percentage: 50 },
    { category: "Development", count: 3, percentage: 30 },
    { category: "__UNCATEGORIZED__", count: 2, percentage: 20 },
  ];

  describe("rendering", () => {
    it("shows the card title", () => {
      render(<AppsByCategory data={mockData} />);

      expect(screen.getByText("Apps by category")).toBeInTheDocument();
    });

    it("renders the chart", () => {
      render(<AppsByCategory data={mockData} />);

      expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
    });

    it("shows the category list", () => {
      render(<AppsByCategory data={mockData} />);

      expect(screen.getByText(/Collaboration/)).toBeInTheDocument();
      expect(screen.getByText(/Development/)).toBeInTheDocument();
      expect(screen.getByText(/Other/)).toBeInTheDocument();
    });
  });

  describe("empty data", () => {
    it("shows an empty-state message when there is no data", () => {
      render(<AppsByCategory data={[]} />);

      expect(screen.getByText("No registered apps.")).toBeInTheDocument();
      expect(screen.queryByTestId("pie-chart")).not.toBeInTheDocument();
    });
  });

  describe("percentages", () => {
    it("shows the percentage for each category", () => {
      render(<AppsByCategory data={mockData} />);

      expect(screen.getByText(/50%/)).toBeInTheDocument();
      expect(screen.getByText(/30%/)).toBeInTheDocument();
      expect(screen.getByText(/20%/)).toBeInTheDocument();
    });
  });
});
