// src/components/dashboard/recent-activity.test.tsx
import messages from "@/i18n/messages/en.json";
import type { RecentActivityItem } from "@/types/dashboard";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecentActivity } from "./recent-activity";

describe("RecentActivity", () => {
  const renderWithIntl = (ui: React.ReactElement) =>
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        {ui}
      </NextIntlClientProvider>
    );

  const now = new Date("2025-11-30T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockActivities: RecentActivityItem[] = [
    {
      id: "log-1",
      action: "CREATE_APP",
      entityType: "App",
      entityId: "app-1",
      userName: "John Smith",
      userEmail: "hong@test.com",
      createdAt: new Date("2025-11-30T11:30:00Z"),
      description: "Added an app",
    },
    {
      id: "log-2",
      action: "USER_TERMINATED",
      entityType: "User",
      entityId: "user-2",
      userName: undefined,
      userEmail: "system@test.com",
      createdAt: new Date("2025-11-30T10:00:00Z"),
      description: "Offboarded a user",
    },
    {
      id: "log-3",
      action: "CREATE_SUBSCRIPTION",
      entityType: "Subscription",
      entityId: "sub-1",
      userName: "Ahmed Khan",
      userEmail: undefined,
      createdAt: new Date("2025-11-30T09:00:00Z"),
      description: "Registered a subscription",
    },
  ];

  describe("rendering", () => {
    it("shows the card title", () => {
      renderWithIntl(<RecentActivity activities={mockActivities} />);

      expect(screen.getByText("Recent activity")).toBeInTheDocument();
    });

    it("shows the activity list", () => {
      renderWithIntl(<RecentActivity activities={mockActivities} />);

      expect(screen.getByText("John Smith")).toBeInTheDocument();
      expect(screen.getByText("Added an app")).toBeInTheDocument();
    });

    it("shows the email when there is no user name", () => {
      renderWithIntl(<RecentActivity activities={mockActivities} />);

      expect(screen.getByText("system@test.com")).toBeInTheDocument();
    });

    it("shows System when there is no user name or email", () => {
      const activitiesWithNoUser: RecentActivityItem[] = [
        {
          id: "log-4",
          action: "SYSTEM_UPDATE",
          entityType: "System",
          createdAt: new Date("2025-11-30T08:00:00Z"),
          description: "System update",
        },
      ];

      renderWithIntl(<RecentActivity activities={activitiesWithNoUser} />);

      expect(screen.getByText("System")).toBeInTheDocument();
    });
  });

  describe("empty data", () => {
    it("shows an empty-state message when there is no activity", () => {
      renderWithIntl(<RecentActivity activities={[]} />);

      expect(screen.getByText("No recent activity yet.")).toBeInTheDocument();
    });
  });

  describe("activity description", () => {
    it("shows the description of each activity", () => {
      renderWithIntl(<RecentActivity activities={mockActivities} />);

      expect(screen.getByText("Added an app")).toBeInTheDocument();
      expect(screen.getByText("Offboarded a user")).toBeInTheDocument();
      expect(screen.getByText("Registered a subscription")).toBeInTheDocument();
    });
  });
});
