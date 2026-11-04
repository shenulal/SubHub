// src/lib/services/notification/reminders.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    organization: { findMany: vi.fn() },
    subscription: { findMany: vi.fn() },
    reminderDispatch: { findUnique: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/settings/service", () => ({ getSettings: vi.fn() }));
vi.mock("./adapters/approvers", () => ({
  getApproverIdsForSubscription: vi.fn(),
}));
vi.mock("./adapters/money", () => ({
  formatMoneyForNotification: vi.fn(
    (a: number, c: string) => `${c} ${a.toFixed(2)}`
  ),
}));
vi.mock("./center", () => ({ notify: vi.fn() }));

import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings/service";
import { getApproverIdsForSubscription } from "./adapters/approvers";
import { notify } from "./center";
import {
  dueLeadDays,
  processSubscriptionReminders,
  resolveLeadDays,
} from "./reminders";

// "today" = 2024-03-11 in Asia/Dubai (05:00Z)
const NOW = new Date("2024-03-11T05:00:00Z");

const settings = {
  "general.timezone": "Asia/Dubai",
  "subscriptions.defaultReminderLeadDays": [7, 3, 1],
  "notifications.copyApproversOnRenewal": true,
};

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    amount: 120,
    currency: "AED",
    billingCycle: "MONTHLY",
    renewalDate: new Date("2024-03-18T12:00:00Z"), // 7 days from today
    reminderLeadDays: [7, 1],
    renewalAlert30: true,
    renewalAlert60: false,
    renewalAlert90: false,
    ownerId: "owner",
    isPersonal: false,
    owner: { name: "Owner", email: "owner@example.com" },
    app: { name: "Slack" },
    assignedUsers: [{ userId: "assignee" }, { userId: "owner" }],
    team: { approverId: "team-approver" },
    approvalRequest: { id: "req-1" },
    ...overrides,
  };
}

describe("resolveLeadDays / dueLeadDays", () => {
  it("prefers subscription lead days and falls back to the organisation default", () => {
    expect(resolveLeadDays(subscription() as never, [14], false)).toEqual([
      7, 1,
    ]);
    expect(
      resolveLeadDays(
        subscription({ reminderLeadDays: [] }) as never,
        [14, 3],
        false
      )
    ).toEqual([14, 3]);
  });

  it("limits legacy mode to flagged 30/60/90 lead days", () => {
    expect(
      resolveLeadDays(
        subscription({ renewalAlert90: true }) as never,
        [7],
        true
      )
    ).toEqual([30, 90]);
  });

  it("matches lead days where renewalDate − lead == today in the org zone", () => {
    const renewal = new Date("2024-03-18T12:00:00Z");
    expect(dueLeadDays(renewal, [7, 3, 1], "2024-03-11", "Asia/Dubai")).toEqual(
      [7]
    );
    expect(dueLeadDays(renewal, [3, 1], "2024-03-11", "Asia/Dubai")).toEqual(
      []
    );
    // 2024-03-11T22:00Z is already 2024-03-12 in Dubai → lead 6
    expect(
      dueLeadDays(
        new Date("2024-03-11T22:00:00Z"),
        [0, 1, 6],
        "2024-03-11",
        "Asia/Dubai"
      )
    ).toEqual([1]);
  });
});

describe("processSubscriptionReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.organization.findMany).mockResolvedValue([
      { id: "org-1", name: "Acme" },
    ] as never);
    vi.mocked(getSettings).mockResolvedValue(settings as never);
    vi.mocked(prisma.subscription.findMany).mockResolvedValue([
      subscription(),
    ] as never);
    vi.mocked(prisma.reminderDispatch.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.reminderDispatch.create).mockResolvedValue({} as never);
    vi.mocked(getApproverIdsForSubscription).mockResolvedValue([
      "approver-1",
      "owner",
    ]);
    vi.mocked(notify).mockResolvedValue({
      inAppCreated: 1,
      emailsSent: 1,
      pushSent: 0,
      deferred: 0,
      skipped: 0,
      deduped: 0,
    });
  });

  it("notifies owner + assignees + team approver, copies approvers and records the dispatch", async () => {
    const result = await processSubscriptionReminders({ now: NOW });

    expect(notify).toHaveBeenCalledTimes(2);
    const [primary, approvers] = vi.mocked(notify).mock.calls.map((c) => c[0]);
    expect(primary).toMatchObject({
      organizationId: "org-1",
      type: "RENEWAL_REMINDER",
      link: "/subscriptions/sub-1",
      dedupeKey: "renewal:sub-1:2024-03-18:7:RENEWAL_REMINDER",
    });
    expect(primary.userIds).toEqual(["owner", "assignee", "team-approver"]);
    expect(primary.email?.subject).toContain("Slack");
    expect(primary.templateVars).toMatchObject({
      serviceName: "Slack",
      daysUntil: 7,
      currency: "AED",
    });
    // approver already in primary list is not double-notified
    expect(approvers).toMatchObject({
      type: "APPROVER_RENEWAL",
      userIds: ["approver-1"],
    });

    expect(prisma.reminderDispatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subscriptionId: "sub-1",
        kind: "RENEWAL",
        leadDays: 7,
        targetDate: new Date("2024-03-18T00:00:00.000Z"),
        recipientCount: 4,
      }),
    });
    expect(result).toMatchObject({
      organizations: 1,
      subscriptionsChecked: 1,
      remindersSent: 1,
      errors: [],
    });
  });

  it("does not copy approvers when the organisation setting is off", async () => {
    vi.mocked(getSettings).mockResolvedValue({
      ...settings,
      "notifications.copyApproversOnRenewal": false,
    } as never);

    await processSubscriptionReminders({ now: NOW });

    expect(getApproverIdsForSubscription).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("skips lead days already dispatched (unique guard)", async () => {
    vi.mocked(prisma.reminderDispatch.findUnique).mockResolvedValue({
      id: "d1",
    } as never);

    const result = await processSubscriptionReminders({ now: NOW });

    expect(notify).not.toHaveBeenCalled();
    expect(result.skippedDuplicates).toBe(1);
    expect(result.remindersSent).toBe(0);
  });

  it("does nothing when no lead day is due today", async () => {
    vi.mocked(prisma.subscription.findMany).mockResolvedValue([
      subscription({ reminderLeadDays: [3, 1] }),
    ] as never);

    const result = await processSubscriptionReminders({ now: NOW });

    expect(notify).not.toHaveBeenCalled();
    expect(result.remindersSent).toBe(0);
  });

  it("legacy mode only uses flagged 30/60/90 lead days", async () => {
    vi.mocked(prisma.subscription.findMany).mockResolvedValue([
      subscription({
        renewalDate: new Date("2024-04-10T12:00:00Z"),
        renewalAlert30: true,
      }),
    ] as never);

    const result = await processSubscriptionReminders({
      now: NOW,
      legacyFlagsOnly: true,
    });

    expect(notify).toHaveBeenCalled();
    expect(vi.mocked(notify).mock.calls[0][0].dedupeKey).toContain(":30:");
    expect(result.remindersSent).toBe(1);
  });

  it("collects per-subscription errors without aborting the run", async () => {
    vi.mocked(notify).mockRejectedValueOnce(new Error("smtp down"));

    const result = await processSubscriptionReminders({ now: NOW });

    expect(result.errors).toEqual(["sub-1/7: smtp down"]);
  });
});
