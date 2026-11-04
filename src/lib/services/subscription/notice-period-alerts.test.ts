import { prisma } from "@/lib/db";
import { notify } from "@/lib/services/notification/center";
import { getSettings } from "@/lib/settings/service";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordDispatchOnce, resolveAlertRecipients } from "./alert-support";
import { processNoticePeriodAlerts } from "./notice-period-alerts";

vi.mock("@/lib/db", () => ({
  prisma: {
    organization: { findMany: vi.fn() },
    subscription: { findMany: vi.fn() },
    reminderDispatch: { updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/settings/service", () => ({ getSettings: vi.fn() }));
vi.mock("@/lib/services/notification/center", () => ({ notify: vi.fn() }));
vi.mock("./alert-support", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./alert-support")>();
  return {
    ...actual,
    listOrganizationIds: vi.fn(async () => ["org-1"]),
    recordDispatchOnce: vi.fn(),
    resolveAlertRecipients: vi.fn(async () => ["owner-1", "admin-1"]),
  };
});

const NOW = new Date("2026-11-04T06:45:00Z"); // 10:45 in Dubai → today = Nov 4

const subscription = {
  id: "sub-1",
  ownerId: "owner-1",
  teamId: null,
  cancellationDeadline: new Date("2026-11-11T00:00:00Z"),
  endDate: new Date("2026-12-11T00:00:00Z"),
  noticePeriodDays: 30,
  app: { name: "Slack" },
};

describe("processNoticePeriodAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSettings).mockResolvedValue({
      "subscriptions.noticePeriodAlertLeadDays": [7, 1],
      "general.timezone": "Asia/Dubai",
    } as never);
    vi.mocked(recordDispatchOnce).mockResolvedValue(true);
  });

  it("queries each lead window in the organisation's local day", async () => {
    vi.mocked(prisma.subscription.findMany).mockResolvedValue([] as never);
    await processNoticePeriodAlerts(NOW);
    expect(prisma.subscription.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          status: "ACTIVE",
          cancellationDeadline: {
            gte: new Date("2026-11-11T00:00:00Z"),
            lt: new Date("2026-11-12T00:00:00Z"),
          },
        }),
      })
    );
    expect(prisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cancellationDeadline: {
            gte: new Date("2026-11-05T00:00:00Z"),
            lt: new Date("2026-11-06T00:00:00Z"),
          },
        }),
      })
    );
  });

  it("notifies owner and approvers and records the dispatch", async () => {
    vi.mocked(prisma.subscription.findMany)
      .mockResolvedValueOnce([subscription] as never)
      .mockResolvedValueOnce([] as never);
    const result = await processNoticePeriodAlerts(NOW);

    expect(resolveAlertRecipients).toHaveBeenCalledWith("org-1", subscription);
    expect(recordDispatchOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: "sub-1",
        kind: "NOTICE_PERIOD",
        leadDays: 7,
        targetDate: new Date("2026-11-11T00:00:00Z"),
      })
    );
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        userIds: ["owner-1", "admin-1"],
        type: "NOTICE_PERIOD",
        dedupeKey: "notice:sub-1:2026-11-11:7",
        link: "/subscriptions/sub-1?tab=cancellation",
      })
    );
    expect(prisma.reminderDispatch.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { recipientCount: 2 } })
    );
    expect(result).toMatchObject({
      processedOrganizations: 1,
      matched: 1,
      notified: 1,
      skipped: 0,
    });
  });

  it("skips subscriptions whose reminder was already dispatched", async () => {
    vi.mocked(prisma.subscription.findMany)
      .mockResolvedValueOnce([subscription] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(recordDispatchOnce).mockResolvedValue(false);
    const result = await processNoticePeriodAlerts(NOW);
    expect(notify).not.toHaveBeenCalled();
    expect(result).toMatchObject({ matched: 1, notified: 0, skipped: 1 });
  });

  it("collects per-organisation errors without aborting", async () => {
    vi.mocked(getSettings).mockRejectedValue(new Error("settings down"));
    const result = await processNoticePeriodAlerts(NOW);
    expect(result.errors).toEqual(["org-1: settings down"]);
  });
});
