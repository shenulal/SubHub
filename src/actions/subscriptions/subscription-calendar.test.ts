// src/actions/subscriptions/subscription-calendar.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getRenewalCalendar, getRenewalsByDate } from "./subscription-calendar";

import { prisma } from "@/lib/db";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireOrganization: vi.fn().mockResolvedValue({
    organizationId: "test-org-id",
  }),
}));

describe("subscription-calendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRenewalCalendar", () => {
    it("should show recurring renewals for current/future months", async () => {
      // Arrange: current/future month - recurring renewal logic applies
      const mockSubscriptions = [
        {
          id: "sub-1",
          appId: "app-1",
          renewalDate: new Date("2099-02-15T00:00:00Z"),
          startDate: new Date("2099-02-15T00:00:00Z"),
          endDate: null,
          billingCycle: "MONTHLY",
          amount: { toNumber: () => 10000 },
          currency: "KRW",
          notes: "Pro Plan",
          status: "ACTIVE",
          app: {
            name: "Slack",
            customLogoUrl: "https://example.com/slack.png",
          },
        },
        {
          id: "sub-2",
          appId: "app-2",
          renewalDate: new Date("2099-03-20T00:00:00Z"),
          startDate: new Date("2099-03-20T00:00:00Z"),
          endDate: null,
          billingCycle: "MONTHLY",
          amount: { toNumber: () => 20000 },
          currency: "KRW",
          notes: "Enterprise Plan",
          status: "ACTIVE",
          app: {
            name: "Notion",
            customLogoUrl: "https://example.com/notion.png",
          },
        },
      ];

      vi.mocked(prisma.subscription.findMany).mockResolvedValue(
        mockSubscriptions as never
      );

      // Act: query a future month
      const result = await getRenewalCalendar(2099, 3);

      // Assert
      expect(result.year).toBe(2099);
      expect(result.month).toBe(3);

      // Subscription from 15 Feb → also shown on 15 Mar (recurring renewal)
      expect(result.renewals["2099-03-15"]).toBeDefined();
      expect(result.renewals["2099-03-15"]).toHaveLength(1);
      expect(result.renewals["2099-03-15"][0].appName).toBe("Slack");

      // Subscription from 20 Mar → shown on 20 Mar
      expect(result.renewals["2099-03-20"]).toBeDefined();
      expect(result.renewals["2099-03-20"]).toHaveLength(1);
      expect(result.renewals["2099-03-20"][0].appName).toBe("Notion");
    });

    it("should show only actual DB records for past months", async () => {
      // Arrange: past month - only actual DB data is shown
      const mockSubscriptions = [
        {
          id: "sub-1",
          appId: "app-1",
          renewalDate: new Date("2020-01-15T00:00:00Z"),
          startDate: new Date("2020-01-15T00:00:00Z"),
          endDate: null,
          billingCycle: "MONTHLY",
          amount: { toNumber: () => 10000 },
          currency: "KRW",
          notes: "Pro Plan",
          status: "ACTIVE",
          app: {
            name: "Slack",
            customLogoUrl: "https://example.com/slack.png",
          },
        },
      ];

      vi.mocked(prisma.subscription.findMany).mockResolvedValue(
        mockSubscriptions as never
      );

      // Act: query a past month
      const result = await getRenewalCalendar(2020, 1);

      // Assert
      expect(result.year).toBe(2020);
      expect(result.month).toBe(1);

      // Only dates that actually exist in the DB are shown
      expect(result.renewals["2020-01-15"]).toBeDefined();
      expect(result.renewals["2020-01-15"]).toHaveLength(1);
      expect(result.renewals["2020-01-15"][0].appName).toBe("Slack");
    });

    it("should group multiple subscriptions on the same calculated date", async () => {
      // Arrange: future month, both subscriptions renew on the 15th monthly
      const mockSubscriptions = [
        {
          id: "sub-1",
          appId: "app-1",
          renewalDate: new Date("2099-02-15T00:00:00Z"),
          startDate: new Date("2099-02-15T00:00:00Z"),
          endDate: null,
          billingCycle: "MONTHLY",
          amount: { toNumber: () => 10000 },
          currency: "KRW",
          notes: "Plan A",
          status: "ACTIVE",
          app: { name: "Slack", customLogoUrl: null },
        },
        {
          id: "sub-2",
          appId: "app-2",
          renewalDate: new Date("2099-01-15T00:00:00Z"),
          startDate: new Date("2099-01-15T00:00:00Z"),
          endDate: null,
          billingCycle: "MONTHLY",
          amount: { toNumber: () => 20000 },
          currency: "KRW",
          notes: "Plan B",
          status: "ACTIVE",
          app: { name: "Notion", customLogoUrl: null },
        },
      ];

      vi.mocked(prisma.subscription.findMany).mockResolvedValue(
        mockSubscriptions as never
      );

      // Act
      const result = await getRenewalCalendar(2099, 3);

      // Assert
      expect(result.renewals["2099-03-15"]).toHaveLength(2);
      expect(result.renewals["2099-03-15"][0].appName).toBe("Slack");
      expect(result.renewals["2099-03-15"][1].appName).toBe("Notion");
    });

    it("should handle yearly renewals correctly", async () => {
      // Arrange: subscription renewing every year on 15 March
      const mockSubscriptions = [
        {
          id: "sub-1",
          appId: "app-1",
          renewalDate: new Date("2098-03-15T00:00:00Z"),
          startDate: new Date("2098-03-15T00:00:00Z"),
          endDate: null,
          billingCycle: "YEARLY",
          amount: { toNumber: () => 10000 },
          currency: "KRW",
          notes: "Yearly Plan",
          status: "ACTIVE",
          app: { name: "Slack", customLogoUrl: null },
        },
      ];

      vi.mocked(prisma.subscription.findMany).mockResolvedValue(
        mockSubscriptions as never
      );

      // Act
      const result = await getRenewalCalendar(2099, 3); // March 2099

      // Assert: should appear on 15 March 2099
      expect(result.renewals["2099-03-15"]).toBeDefined();
      expect(result.renewals["2099-03-15"]).toHaveLength(1);
      expect(result.renewals["2099-03-15"][0].appName).toBe("Slack");
    });

    it("should not show yearly renewals in wrong months", async () => {
      // Arrange: subscription renewing every year on 15 March
      const mockSubscriptions = [
        {
          id: "sub-1",
          appId: "app-1",
          renewalDate: new Date("2098-03-15T00:00:00Z"),
          startDate: new Date("2098-03-15T00:00:00Z"),
          endDate: null,
          billingCycle: "YEARLY",
          amount: { toNumber: () => 10000 },
          currency: "KRW",
          notes: "Yearly Plan",
          status: "ACTIVE",
          app: { name: "Slack", customLogoUrl: null },
        },
      ];

      vi.mocked(prisma.subscription.findMany).mockResolvedValue(
        mockSubscriptions as never
      );

      // Act
      const result = await getRenewalCalendar(2099, 4); // April 2099 (not a renewal month)

      // Assert: should not appear in April
      expect(result.renewals).toEqual({});
    });

    it("should return empty renewals when no subscriptions exist", async () => {
      // Arrange
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      // Act
      const result = await getRenewalCalendar(2099, 3);

      // Assert
      expect(result.year).toBe(2099);
      expect(result.month).toBe(3);
      expect(result.renewals).toEqual({});
    });

    it("should not include subscriptions that start after the query month", async () => {
      // Arrange: a subscription starting in April should not appear in March
      const mockSubscriptions = [
        {
          id: "sub-1",
          appId: "app-1",
          renewalDate: new Date("2099-04-15T00:00:00Z"),
          startDate: new Date("2099-04-15T00:00:00Z"),
          endDate: null,
          billingCycle: "MONTHLY",
          amount: { toNumber: () => 10000 },
          currency: "KRW",
          notes: "Future subscription",
          status: "ACTIVE",
          app: { name: "Slack", customLogoUrl: null },
        },
      ];

      vi.mocked(prisma.subscription.findMany).mockResolvedValue(
        mockSubscriptions as never
      );

      // Act
      const result = await getRenewalCalendar(2099, 3);

      // Assert
      expect(result.renewals).toEqual({});
    });

    it("should not include subscriptions that ended before the query month", async () => {
      // Arrange: a subscription that ended in February should not appear in March
      const mockSubscriptions = [
        {
          id: "sub-1",
          appId: "app-1",
          renewalDate: new Date("2099-01-15T00:00:00Z"),
          startDate: new Date("2099-01-15T00:00:00Z"),
          endDate: new Date("2099-02-28T23:59:59Z"),
          billingCycle: "MONTHLY",
          amount: { toNumber: () => 10000 },
          currency: "KRW",
          notes: "Ended subscription",
          status: "ACTIVE",
          app: { name: "Slack", customLogoUrl: null },
        },
      ];

      vi.mocked(prisma.subscription.findMany).mockResolvedValue(
        mockSubscriptions as never
      );

      // Act
      const result = await getRenewalCalendar(2099, 3);

      // Assert
      expect(result.renewals).toEqual({});
    });

    it("should handle monthly renewals on day 31 in months with 30 days", async () => {
      // Arrange: subscription from 31 Jan → should appear on the 28th in February
      const mockSubscriptions = [
        {
          id: "sub-1",
          appId: "app-1",
          renewalDate: new Date("2099-01-31T00:00:00Z"),
          startDate: new Date("2099-01-31T00:00:00Z"),
          endDate: null,
          billingCycle: "MONTHLY",
          amount: { toNumber: () => 10000 },
          currency: "KRW",
          notes: "Day 31 subscription",
          status: "ACTIVE",
          app: { name: "Slack", customLogoUrl: null },
        },
      ];

      vi.mocked(prisma.subscription.findMany).mockResolvedValue(
        mockSubscriptions as never
      );

      // Act
      const result = await getRenewalCalendar(2099, 2); // February (28 days)

      // Assert
      expect(result.renewals["2099-02-28"]).toBeDefined();
      expect(result.renewals["2099-02-28"]).toHaveLength(1);
      expect(result.renewals["2099-02-28"][0].appName).toBe("Slack");
    });
  });

  describe("getRenewalsByDate", () => {
    it("should return renewals for a past date from DB", async () => {
      // Arrange: past date - queried directly from the DB
      const mockSubscriptions = [
        {
          id: "sub-1",
          appId: "app-1",
          renewalDate: new Date("2020-03-15T10:00:00Z"),
          startDate: new Date("2020-03-15T00:00:00Z"),
          endDate: null,
          billingCycle: "MONTHLY",
          amount: { toNumber: () => 10000 },
          currency: "KRW",
          notes: "Pro Plan",
          status: "ACTIVE",
          app: {
            name: "Slack",
            customLogoUrl: "https://example.com/slack.png",
          },
        },
      ];

      vi.mocked(prisma.subscription.findMany).mockResolvedValue(
        mockSubscriptions as never
      );

      // Act
      const result = await getRenewalsByDate("2020-03-15");

      // Assert
      expect(result.date).toBe("2020-03-15");
      expect(result.renewals).toHaveLength(1);
      expect(result.renewals[0].appName).toBe("Slack");
      expect(result.renewals[0].amount).toBe(10000);
    });

    it("should return calculated renewals for a future date (monthly billing)", async () => {
      // Arrange: future date - calculation logic applies
      const mockSubscriptions = [
        {
          id: "sub-1",
          appId: "app-1",
          renewalDate: new Date("2099-02-15T00:00:00Z"),
          startDate: new Date("2099-02-15T00:00:00Z"),
          endDate: null,
          billingCycle: "MONTHLY",
          amount: { toNumber: () => 10000 },
          currency: "KRW",
          notes: "Pro Plan",
          status: "ACTIVE",
          app: {
            name: "Slack",
            customLogoUrl: "https://example.com/slack.png",
          },
        },
      ];

      vi.mocked(prisma.subscription.findMany).mockResolvedValue(
        mockSubscriptions as never
      );

      // Act: query a future date (subscription from 15 Feb → should also appear on 15 Mar)
      const result = await getRenewalsByDate("2099-03-15");

      // Assert
      expect(result.date).toBe("2099-03-15");
      expect(result.renewals).toHaveLength(1);
      expect(result.renewals[0].appName).toBe("Slack");
      expect(result.renewals[0].amount).toBe(10000);
      expect(result.renewals[0].renewalDate).toBe("2099-03-15T00:00:00.000Z");
    });

    it("should return calculated renewals for a future date (yearly billing)", async () => {
      // Arrange: future date, yearly renewal
      const mockSubscriptions = [
        {
          id: "sub-1",
          appId: "app-1",
          renewalDate: new Date("2098-03-15T00:00:00Z"),
          startDate: new Date("2098-03-15T00:00:00Z"),
          endDate: null,
          billingCycle: "YEARLY",
          amount: { toNumber: () => 100000 },
          currency: "KRW",
          notes: "Annual Plan",
          status: "ACTIVE",
          app: {
            name: "Notion",
            customLogoUrl: "https://example.com/notion.png",
          },
        },
      ];

      vi.mocked(prisma.subscription.findMany).mockResolvedValue(
        mockSubscriptions as never
      );

      // Act: query 15 March 2099 (yearly renewal date)
      const result = await getRenewalsByDate("2099-03-15");

      // Assert
      expect(result.date).toBe("2099-03-15");
      expect(result.renewals).toHaveLength(1);
      expect(result.renewals[0].appName).toBe("Notion");
      expect(result.renewals[0].amount).toBe(100000);
    });

    it("should return empty array when no renewals match the future date", async () => {
      // Arrange: future date with no subscription renewing on that day
      const mockSubscriptions = [
        {
          id: "sub-1",
          appId: "app-1",
          renewalDate: new Date("2099-02-20T00:00:00Z"),
          startDate: new Date("2099-02-20T00:00:00Z"),
          endDate: null,
          billingCycle: "MONTHLY",
          amount: { toNumber: () => 10000 },
          currency: "KRW",
          notes: "Pro Plan",
          status: "ACTIVE",
          app: { name: "Slack", customLogoUrl: null },
        },
      ];

      vi.mocked(prisma.subscription.findMany).mockResolvedValue(
        mockSubscriptions as never
      );

      // Act: query 15 March (subscription renews on the 20th monthly)
      const result = await getRenewalsByDate("2099-03-15");

      // Assert
      expect(result.date).toBe("2099-03-15");
      expect(result.renewals).toEqual([]);
    });

    it("should return empty array when no renewals exist for the date", async () => {
      // Arrange
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      // Act
      const result = await getRenewalsByDate("2025-03-15");

      // Assert
      expect(result.date).toBe("2025-03-15");
      expect(result.renewals).toEqual([]);
    });

    it("should handle null renewalDate gracefully", async () => {
      // Arrange
      const mockSubscriptions = [
        {
          id: "sub-1",
          appId: "app-1",
          renewalDate: null,
          amount: { toNumber: () => 10000 },
          currency: "KRW",
          notes: "Cancelled",
          status: "CANCELLED",
          app: { name: "Slack", customLogoUrl: null },
        },
      ];

      vi.mocked(prisma.subscription.findMany).mockResolvedValue(
        mockSubscriptions as never
      );

      // Act
      const result = await getRenewalsByDate("2025-03-15");

      // Assert
      expect(result.renewals).toHaveLength(1);
      expect(result.renewals[0].renewalDate).toBe("2025-03-15");
    });
  });
});
