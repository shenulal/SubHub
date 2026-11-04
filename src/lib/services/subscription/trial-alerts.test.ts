import { prisma } from "@/lib/db";
import { notify } from "@/lib/services/notification/center";
import { getSettings } from "@/lib/settings/service";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordDispatchOnce } from "./alert-support";
import { processTrialAlerts } from "./trial-alerts";

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: { findMany: vi.fn(), update: vi.fn() },
    reminderDispatch: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/settings/service", () => ({ getSettings: vi.fn() }));
vi.mock("@/lib/services/notification/center", () => ({ notify: vi.fn() }));
vi.mock("./alert-support", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./alert-support")>();
  return {
    ...actual,
    listOrganizationIds: vi.fn(async () => ["org-1"]),
    recordDispatchOnce: vi.fn(async () => true),
    resolveAlertRecipients: vi.fn(async () => ["owner-1"]),
  };
});

const NOW = new Date("2026-11-04T12:00:00Z");

const trial = {
  id: "sub-t",
  ownerId: "owner-1",
  teamId: null,
  trialEndsAt: new Date("2026-11-06T00:00:00Z"),
  autoRenewal: true,
  amount: 49,
  currency: "USD",
  app: { name: "Figma" },
};

describe("processTrialAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSettings).mockResolvedValue({
      "subscriptions.trialAlertLeadDays": [2],
      "general.timezone": "UTC",
    } as never);
  });

  it("alerts trials ending in `lead` days and converts expired auto-renewing trials", async () => {
    vi.mocked(prisma.subscription.findMany)
      .mockResolvedValueOnce([trial] as never) // lead window
      .mockResolvedValueOnce([
        { id: "sub-old", trialEndsAt: new Date("2026-11-01T00:00:00Z") },
      ] as never); // expired
    const result = await processTrialAlerts(NOW);

    expect(prisma.subscription.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          isTrial: true,
          trialEndsAt: {
            gte: new Date("2026-11-06T00:00:00Z"),
            lt: new Date("2026-11-07T00:00:00Z"),
          },
        }),
      })
    );
    expect(recordDispatchOnce).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "TRIAL_ENDING", leadDays: 2 })
    );
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "TRIAL_ENDING",
        userIds: ["owner-1"],
        dedupeKey: "trial:sub-t:2026-11-06:2",
        title: "Figma trial ends in 2 days",
      })
    );

    expect(prisma.subscription.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          isTrial: true,
          autoRenewal: true,
          trialEndsAt: { lt: new Date("2026-11-04T00:00:00Z") },
        }),
      })
    );
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub-old" },
      data: { isTrial: false },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "TRIAL_CONVERTED",
          entityId: "sub-old",
        }),
      })
    );
    expect(result).toMatchObject({ matched: 1, notified: 1, converted: 1 });
  });

  it("does not re-notify when the dispatch already exists", async () => {
    vi.mocked(recordDispatchOnce).mockResolvedValueOnce(false);
    vi.mocked(prisma.subscription.findMany)
      .mockResolvedValueOnce([trial] as never)
      .mockResolvedValueOnce([] as never);
    const result = await processTrialAlerts(NOW);
    expect(notify).not.toHaveBeenCalled();
    expect(result).toMatchObject({ skipped: 1, converted: 0 });
  });
});
