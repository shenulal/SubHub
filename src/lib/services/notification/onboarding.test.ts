// src/lib/services/notification/onboarding.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: { count: vi.fn() },
    invitation: { count: vi.fn() },
    user: { count: vi.fn(), findUnique: vi.fn() },
    approvalPolicy: { count: vi.fn() },
    integration: { count: vi.fn() },
    mailboxConnection: { count: vi.fn() },
    onboardingProgress: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));
vi.mock("@/lib/settings/service", () => ({ getSettings: vi.fn() }));

import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings/service";
import {
  detectOnboardingSteps,
  dismissOnboardingFor,
  getOnboardingProgressFor,
  toProgressView,
} from "./onboarding";

function arrange(
  counts: Partial<Record<string, number>> = {},
  prefs: unknown = {},
  currency = "AED"
) {
  vi.mocked(prisma.subscription.count)
    .mockResolvedValueOnce(counts.subscriptions ?? 0)
    .mockResolvedValueOnce(counts.subsWithLead ?? 0);
  vi.mocked(prisma.invitation.count).mockResolvedValue(counts.invitations ?? 0);
  vi.mocked(prisma.user.count).mockResolvedValue(counts.members ?? 1);
  vi.mocked(prisma.approvalPolicy.count).mockResolvedValue(
    counts.policies ?? 0
  );
  vi.mocked(prisma.integration.count).mockResolvedValue(
    counts.integrations ?? 0
  );
  vi.mocked(prisma.mailboxConnection.count).mockResolvedValue(
    counts.mailboxes ?? 0
  );
  vi.mocked(getSettings).mockResolvedValue({
    "finance.baseCurrency": currency,
  } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    preferences: prefs,
  } as never);
}

describe("onboarding service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("detects nothing done for a fresh organisation", async () => {
    arrange();
    const d = await detectOnboardingSteps("org-1", "u1");
    expect(Object.values(d).every((v) => v === false)).toBe(true);
  });

  it("auto-detects each step", async () => {
    arrange(
      {
        subscriptions: 2,
        subsWithLead: 1,
        invitations: 1,
        policies: 1,
        mailboxes: 1,
      },
      {},
      "SAR"
    );
    const d = await detectOnboardingSteps("org-1", "u1");
    expect(d).toEqual({
      firstSubscription: true,
      reminderLeadDays: true,
      inviteTeammate: true,
      approvalPolicy: true,
      connectIntegration: true,
      baseCurrency: true,
    });
  });

  it("treats personal lead days and a second member as completion", async () => {
    arrange({ members: 2 }, { reminderLeadDays: [7] });
    const d = await detectOnboardingSteps("org-1", "u1");
    expect(d.reminderLeadDays).toBe(true);
    expect(d.inviteTeammate).toBe(true);
  });

  it("builds a progress view with percent and links", () => {
    const view = toProgressView(
      {
        firstSubscription: true,
        reminderLeadDays: true,
        inviteTeammate: false,
        approvalPolicy: false,
        connectIntegration: false,
        baseCurrency: true,
      },
      false
    );
    expect(view).toMatchObject({
      completed: 3,
      total: 6,
      percent: 50,
      dismissed: false,
    });
    expect(view.steps[0]).toEqual({
      key: "firstSubscription",
      done: true,
      href: "/subscriptions/new",
    });
  });

  it("persists detection and reads dismissal", async () => {
    arrange({ subscriptions: 1 });
    vi.mocked(prisma.onboardingProgress.findUnique).mockResolvedValue({
      dismissedAt: new Date(),
    } as never);

    const view = await getOnboardingProgressFor("org-1", "u1");

    expect(view.dismissed).toBe(true);
    expect(prisma.onboardingProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_organizationId: { userId: "u1", organizationId: "org-1" },
        },
        update: { steps: expect.objectContaining({ firstSubscription: true }) },
      })
    );
  });

  it("dismisses per user", async () => {
    const now = new Date("2024-03-01T00:00:00Z");
    await dismissOnboardingFor("org-1", "u1", now);
    expect(prisma.onboardingProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { dismissedAt: now } })
    );
  });
});
