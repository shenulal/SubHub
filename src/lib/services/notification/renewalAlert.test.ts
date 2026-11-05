// src/lib/services/notification/renewalAlert.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: {
      findMany: vi.fn(),
    },
    renewalAlert: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

// Mock the unified reminders service (legacy cron delegates to it)
vi.mock("./reminders", () => ({
  processSubscriptionReminders: vi.fn(),
}));

// Mock email service
vi.mock("./email", () => ({
  sendRenewalAlertEmail: vi
    .fn()
    .mockResolvedValue({ success: true, messageId: "msg-123" }),
}));

import { prisma } from "@/lib/db";
import { sendRenewalAlertEmail } from "./email";
import { processSubscriptionReminders } from "./reminders";
import {
  findUpcomingRenewals,
  processRenewalAlerts,
  sendRenewalAlert,
} from "./renewalAlert";

describe("Renewal Alert Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("findUpcomingRenewals", () => {
    it("finds subscriptions renewing within 30 days", async () => {
      const mockSubscriptions = [
        {
          id: "sub-1",
          renewalDate: new Date("2024-02-14"), // in 30 days
          renewalAlert30: true,
          app: { name: "Slack" },
          organization: { id: "org-1", name: "Test Organization" },
          amount: 100000,
          currency: "KRW",
        },
      ];

      vi.mocked(prisma.subscription.findMany).mockResolvedValue(
        mockSubscriptions as never
      );

      const result = await findUpcomingRenewals(30);

      expect(result).toHaveLength(1);
      expect(result[0].app.name).toBe("Slack");
    });

    it("excludes subscriptions with alerts disabled", async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([] as never);

      const result = await findUpcomingRenewals(30);

      expect(result).toHaveLength(0);
    });

    it("finds subscriptions renewing within 60 days", async () => {
      const mockSubscriptions = [
        {
          id: "sub-2",
          renewalDate: new Date("2024-03-14"), // in 58 days
          renewalAlert60: true,
          app: { name: "Notion" },
          organization: { id: "org-1", name: "Test Organization" },
          amount: 50000,
          currency: "KRW",
        },
      ];

      vi.mocked(prisma.subscription.findMany).mockResolvedValue(
        mockSubscriptions as never
      );

      const result = await findUpcomingRenewals(60);

      expect(result).toHaveLength(1);
    });

    it("finds subscriptions renewing within 90 days", async () => {
      const mockSubscriptions = [
        {
          id: "sub-3",
          renewalDate: new Date("2024-04-14"), // in 89 days
          renewalAlert90: true,
          app: { name: "Figma" },
          organization: { id: "org-1", name: "Test Organization" },
          amount: 200000,
          currency: "KRW",
        },
      ];

      vi.mocked(prisma.subscription.findMany).mockResolvedValue(
        mockSubscriptions as never
      );

      const result = await findUpcomingRenewals(90);

      expect(result).toHaveLength(1);
    });
  });

  describe("sendRenewalAlert", () => {
    it("sends renewal alerts to admins", async () => {
      const subscription = {
        id: "sub-1",
        renewalDate: new Date("2024-02-14"),
        app: { name: "Slack" },
        organization: { id: "org-1", name: "Test Organization" },
        amount: 100000,
        currency: "KRW",
      };

      const admins = [
        { email: "admin1@example.com" },
        { email: "admin2@example.com" },
      ];

      vi.mocked(prisma.user.findMany).mockResolvedValue(admins as never);
      vi.mocked(prisma.renewalAlert.findFirst).mockResolvedValue(null as never);
      vi.mocked(prisma.renewalAlert.upsert).mockResolvedValue({
        id: "alert-1",
      } as never);

      const result = await sendRenewalAlert(subscription as never, 30);

      expect(sendRenewalAlertEmail).toHaveBeenCalledTimes(2);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
    });

    it("skips alerts that were already sent", async () => {
      const subscription = {
        id: "sub-1",
        renewalDate: new Date("2024-02-14"),
        app: { name: "Slack" },
        organization: { id: "org-1", name: "Test Organization" },
        amount: 100000,
        currency: "KRW",
      };

      vi.mocked(prisma.renewalAlert.findFirst).mockResolvedValue({
        id: "alert-1",
        sentAt: new Date("2024-01-14"),
      } as never);

      const result = await sendRenewalAlert(subscription as never, 30);

      expect(sendRenewalAlertEmail).not.toHaveBeenCalled();
      expect(result.sent).toBe(0);
      expect(result.skipped).toBe(true);
    });
  });

  describe("processRenewalAlerts (delegates to reminders service)", () => {
    it("delegates to the unified reminders service in legacy flag mode", async () => {
      vi.mocked(processSubscriptionReminders).mockResolvedValue({
        processedAt: new Date("2024-01-15T00:00:00Z"),
        organizations: 1,
        subscriptionsChecked: 2,
        remindersSent: 1,
        recipientsNotified: 3,
        skippedDuplicates: 0,
        errors: [],
      });

      const result = await processRenewalAlerts();

      expect(processSubscriptionReminders).toHaveBeenCalledWith({
        legacyFlagsOnly: true,
      });
      expect(result.legacy).toBe(true);
      expect(result.remindersSent).toBe(1);
      expect(result).toHaveProperty("processedAt");
    });

    it("passes call options through unchanged", async () => {
      vi.mocked(processSubscriptionReminders).mockResolvedValue({
        processedAt: new Date(),
        organizations: 0,
        subscriptionsChecked: 0,
        remindersSent: 0,
        recipientsNotified: 0,
        skippedDuplicates: 0,
        errors: [],
      });

      await processRenewalAlerts({ organizationIds: ["org-1"] });

      expect(processSubscriptionReminders).toHaveBeenCalledWith({
        organizationIds: ["org-1"],
        legacyFlagsOnly: true,
      });
    });
  });
});
