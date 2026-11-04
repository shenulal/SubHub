// src/actions/discovery/calendar-extras.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ALL_READ, FakeForbidden, permissionResult } from "./test-helpers";

const { prisma, requirePermission, getRenewalCalendar } = vi.hoisted(() => ({
  prisma: {
    subscription: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
  requirePermission: vi.fn(),
  getRenewalCalendar: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/rbac/service", () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
  isForbiddenError: (e: unknown) => e instanceof FakeForbidden,
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/actions/subscriptions/subscription-calendar", () => ({
  getRenewalCalendar: (...args: unknown[]) => getRenewalCalendar(...args),
}));
vi.mock("./scope", () => ({
  getWorkspaceScope: vi
    .fn()
    .mockResolvedValue({ scope: "workspace", allowPersonal: true }),
}));

import { getRenewalCalendarWithMarkers } from "./calendar-extras";

const app = {
  name: "Slack",
  customLogoUrl: null,
  catalog: { logoUrl: "https://l" },
};

describe("getRenewalCalendarWithMarkers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermission.mockResolvedValue(permissionResult(ALL_READ));
    prisma.user.findUnique.mockResolvedValue({ teamId: null });
    getRenewalCalendar.mockResolvedValue({
      year: 2026,
      month: 11,
      renewals: { "2026-11-10": [] },
    });
  });

  it("merges the lifecycle calendar with trial and notice markers keyed by UTC day", async () => {
    prisma.subscription.findMany
      .mockResolvedValueOnce([
        {
          id: "t1",
          amount: 5,
          currency: "AED",
          trialEndsAt: new Date("2026-11-12T23:30:00Z"),
          cancellationDeadline: null,
          app,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "n1",
          amount: 9,
          currency: "USD",
          trialEndsAt: null,
          cancellationDeadline: new Date("2026-11-12T01:00:00Z"),
          app,
        },
        {
          id: "n2",
          amount: 1,
          currency: "USD",
          trialEndsAt: null,
          cancellationDeadline: null,
          app,
        },
      ]);
    const result = await getRenewalCalendarWithMarkers(2026, 11);
    expect(result.success).toBe(true);
    expect(getRenewalCalendar).toHaveBeenCalledWith(2026, 11);
    expect(result.data!.renewals).toEqual({ "2026-11-10": [] });
    expect(
      result.data!.markers["2026-11-12"].map((m) => [m.kind, m.subscriptionId])
    ).toEqual([
      ["trialEnd", "t1"],
      ["cancellationDeadline", "n1"],
    ]);
    expect(result.data!.markers["2026-11-12"][0]).toMatchObject({
      appLogoUrl: "https://l",
      amount: 5,
    });
    // Month range + organisation scoping are applied to both queries.
    const where = JSON.stringify(
      prisma.subscription.findMany.mock.calls[0][0].where
    );
    expect(where).toContain('"organizationId":"org-1"');
    expect(where).toContain("2026-11-01T00:00:00.000Z");
  });

  it("validates year/month and honours an explicit scope", async () => {
    expect((await getRenewalCalendarWithMarkers(2026, 13)).success).toBe(false);
    expect((await getRenewalCalendarWithMarkers(1999, 1)).success).toBe(false);
    prisma.subscription.findMany.mockResolvedValue([]);
    const result = await getRenewalCalendarWithMarkers(2026, 11, "personal");
    expect(result.data!.scope).toBe("personal");
    expect(
      JSON.stringify(prisma.subscription.findMany.mock.calls[0][0].where)
    ).toContain('"isPersonal":true');
  });

  it("maps forbidden and unexpected errors", async () => {
    requirePermission.mockRejectedValueOnce(
      new FakeForbidden("subscriptions:read")
    );
    expect((await getRenewalCalendarWithMarkers(2026, 11)).success).toBe(false);
    getRenewalCalendar.mockRejectedValueOnce(new Error("db down"));
    expect(await getRenewalCalendarWithMarkers(2026, 11)).toEqual({
      success: false,
      error: "Could not load calendar",
    });
  });
});
