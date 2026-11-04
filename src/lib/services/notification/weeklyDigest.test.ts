// src/lib/services/notification/weeklyDigest.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    organization: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    app: { count: vi.fn() },
    cardTransaction: { count: vi.fn() },
    subscription: { count: vi.fn() },
    vendorInferenceLog: { count: vi.fn() },
    approvalRequest: { count: vi.fn(), aggregate: vi.fn() },
    priceChangeEvent: { count: vi.fn() },
  },
}));
vi.mock("@/lib/settings/service", () => ({ getSettings: vi.fn() }));
vi.mock("./adapters/money", () => ({
  formatMoneyForNotification: vi.fn(
    (a: number, c: string) => `${c} ${a.toFixed(2)}`
  ),
}));
vi.mock("./center", () => ({ notify: vi.fn() }));

import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings/service";
import { notify } from "./center";
import { buildDigestEmail, collectDigestStats } from "./digest-content";
import { processWeeklyDigest } from "./weeklyDigest";

// Monday 2024-03-11 09:00 Asia/Dubai
const MONDAY = new Date("2024-03-11T05:00:00Z");
const TUESDAY = new Date("2024-03-12T05:00:00Z");

const settings = {
  "notifications.digestEnabled": true,
  "notifications.digestWeekday": 1,
  "notifications.digestTime": "08:00",
  "general.timezone": "Asia/Dubai",
  "discovery.renewingSoonDays": 30,
  "finance.baseCurrency": "AED",
};

function arrangeStats() {
  vi.mocked(prisma.app.count).mockResolvedValue(2);
  vi.mocked(prisma.cardTransaction.count).mockResolvedValue(3);
  vi.mocked(prisma.subscription.count)
    .mockResolvedValueOnce(4)
    .mockResolvedValueOnce(1);
  vi.mocked(prisma.vendorInferenceLog.count).mockResolvedValue(5);
  vi.mocked(prisma.approvalRequest.count).mockResolvedValue(6);
  vi.mocked(prisma.approvalRequest.aggregate).mockResolvedValue({
    _sum: { monthlyAmount: 1234.5 },
  } as never);
  vi.mocked(prisma.priceChangeEvent.count).mockResolvedValue(7);
}

describe("collectDigestStats / buildDigestEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    arrangeStats();
  });

  it("assembles approvals, committed spend, renewals, price changes and trials", async () => {
    const stats = await collectDigestStats("org-1", {
      start: new Date("2024-03-04T05:00:00Z"),
      end: MONDAY,
      renewingSoonDays: 30,
      baseCurrency: "AED",
    });
    expect(stats).toEqual({
      newApps: 2,
      unmatchedPayments: 3,
      upcomingRenewals: 4,
      pendingConfirmations: 5,
      pendingApprovals: 6,
      committedMonthlySpend: 1234.5,
      committedCurrency: "AED",
      priceChangesUnacknowledged: 7,
      trialsEnding: 1,
    });
    expect(prisma.approvalRequest.count).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        status: { in: ["PENDING", "INFO_REQUESTED"] },
      },
    });

    const email = buildDigestEmail(
      "Acme",
      "2024-03-04 ~ 2024-03-11",
      stats,
      30
    );
    expect(email.subject).toBe(
      "[Acme] Weekly digest · 2024-03-04 ~ 2024-03-11"
    );
    expect(email.html).toContain("AED 1234.50");
    expect(email.html).toContain("Pending approvals");
    expect(email.body).toContain("6 pending approvals");
  });
});

describe("processWeeklyDigest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    arrangeStats();
    vi.mocked(prisma.organization.findMany).mockResolvedValue([
      { id: "org-1", name: "Acme" },
    ] as never);
    vi.mocked(getSettings).mockResolvedValue(settings as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "admin" },
      { id: "approver" },
    ] as never);
    vi.mocked(notify).mockResolvedValue({
      inAppCreated: 2,
      emailsSent: 1,
      pushSent: 0,
      deferred: 0,
      skipped: 1,
      deduped: 0,
    });
  });

  it("sends on the configured weekday/time through notify() with a weekly dedupe key", async () => {
    const result = await processWeeklyDigest({ now: MONDAY });

    expect(notify).toHaveBeenCalledTimes(1);
    const input = vi.mocked(notify).mock.calls[0][0];
    expect(input).toMatchObject({
      organizationId: "org-1",
      userIds: ["admin", "approver"],
      type: "DIGEST",
      dedupeKey: "digest:org-1:2024-03-11",
      bypassQuietHours: true,
    });
    expect(input.templateVars).toMatchObject({
      approvalCount: 6,
      renewalCount: 4,
      currency: "AED",
    });
    expect(result).toMatchObject({
      processedOrganizations: 1,
      emailsSent: 1,
      inAppCreated: 2,
      errors: [],
    });
  });

  it("skips organisations outside their digest slot", async () => {
    const result = await processWeeklyDigest({ now: TUESDAY });
    expect(notify).not.toHaveBeenCalled();
    expect(result.skippedOrganizations).toBe(1);
  });

  it("skips organisations that disabled the digest", async () => {
    vi.mocked(getSettings).mockResolvedValue({
      ...settings,
      "notifications.digestEnabled": false,
    } as never);
    const result = await processWeeklyDigest({ now: MONDAY });
    expect(notify).not.toHaveBeenCalled();
    expect(result.skippedOrganizations).toBe(1);
  });

  it("reports organisations without recipients", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    const result = await processWeeklyDigest({ now: MONDAY });
    expect(result.errors).toEqual(["org-1: no digest recipients"]);
  });

  it("captures per-organisation failures", async () => {
    vi.mocked(notify).mockRejectedValue(new Error("boom"));
    const result = await processWeeklyDigest({ now: MONDAY });
    expect(result.success).toBe(true);
    expect(result.errors).toEqual(["org-1: boom"]);
  });
});
