// src/components/subscriptions/renewal-calendar.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Import the component under test (after the mocks)
import type { CalendarData, RenewalItem } from "@/actions/subscriptions";
import { RenewalCalendar } from "./renewal-calendar";

// Mock data for the tests
const mockRenewalItem: RenewalItem = {
  subscriptionId: "sub-1",
  appId: "app-1",
  appName: "Slack",
  appLogo: "/logos/slack.png",
  planName: "Enterprise",
  amount: 100000,
  currency: "KRW",
  renewalDate: "2024-12-15",
  status: "ACTIVE",
};

const mockCalendarData: CalendarData = {
  year: 2024,
  month: 12,
  renewals: {
    "2024-12-15": [mockRenewalItem],
    "2024-12-20": [
      { ...mockRenewalItem, subscriptionId: "sub-2", appName: "Notion" },
    ],
  },
};

describe("RenewalCalendar", () => {
  const mockOnMonthChange = vi.fn();
  const mockOnDateSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders the calendar correctly", () => {
      render(
        <RenewalCalendar
          calendarData={mockCalendarData}
          onMonthChange={mockOnMonthChange}
          onDateSelect={mockOnDateSelect}
        />
      );

      // Month and year are shown
      expect(screen.getByText(/December 2024/)).toBeInTheDocument();
    });

    it("shows a badge on renewal dates", () => {
      render(
        <RenewalCalendar
          calendarData={mockCalendarData}
          onMonthChange={mockOnMonthChange}
          onDateSelect={mockOnDateSelect}
        />
      );

      // Badge check (renewal count)
      const badges = screen.getAllByTestId("renewal-badge");
      expect(badges.length).toBeGreaterThanOrEqual(2);
    });

    it("shows an empty calendar for empty data", () => {
      const emptyData: CalendarData = {
        year: 2024,
        month: 12,
        renewals: {},
      };

      render(
        <RenewalCalendar
          calendarData={emptyData}
          onMonthChange={mockOnMonthChange}
          onDateSelect={mockOnDateSelect}
        />
      );

      expect(screen.getByText(/December 2024/)).toBeInTheDocument();
      expect(screen.queryAllByTestId("renewal-badge")).toHaveLength(0);
    });
  });

  describe("navigation", () => {
    it("calls onMonthChange when the previous-month button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <RenewalCalendar
          calendarData={mockCalendarData}
          onMonthChange={mockOnMonthChange}
          onDateSelect={mockOnDateSelect}
        />
      );

      const prevButton = screen.getByRole("button", { name: /Previous/ });
      await user.click(prevButton);

      expect(mockOnMonthChange).toHaveBeenCalledWith(2024, 11);
    });

    it("calls onMonthChange when the next-month button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <RenewalCalendar
          calendarData={mockCalendarData}
          onMonthChange={mockOnMonthChange}
          onDateSelect={mockOnDateSelect}
        />
      );

      const nextButton = screen.getByRole("button", { name: /Next/ });
      await user.click(nextButton);

      expect(mockOnMonthChange).toHaveBeenCalledWith(2025, 1);
    });

    it("moves to the current month when Today is clicked", async () => {
      const user = userEvent.setup();

      render(
        <RenewalCalendar
          calendarData={mockCalendarData}
          onMonthChange={mockOnMonthChange}
          onDateSelect={mockOnDateSelect}
        />
      );

      const todayButton = screen.getByRole("button", { name: /Today/ });
      await user.click(todayButton);

      // Called with the current date
      const now = new Date();
      expect(mockOnMonthChange).toHaveBeenCalledWith(
        now.getFullYear(),
        now.getMonth() + 1
      );
    });
  });

  describe("date selection", () => {
    it("calls onDateSelect when a date with renewals is clicked", async () => {
      const user = userEvent.setup();

      render(
        <RenewalCalendar
          calendarData={mockCalendarData}
          onMonthChange={mockOnMonthChange}
          onDateSelect={mockOnDateSelect}
        />
      );

      // Click the 15th (a day with renewals)
      const dayWithRenewal = screen.getByTestId("day-15");
      await user.click(dayWithRenewal);

      expect(mockOnDateSelect).toHaveBeenCalledWith("2024-12-15");
    });
  });
});
