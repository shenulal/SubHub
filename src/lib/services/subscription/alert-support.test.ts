import { prisma } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  recordDispatchOnce,
  resolveAlertRecipients,
  targetDayForLead,
  todayInTimeZone,
  utcDayRange,
} from "./alert-support";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findMany: vi.fn() },
    team: { findFirst: vi.fn() },
    reminderDispatch: { findUnique: vi.fn(), create: vi.fn() },
    organization: { findMany: vi.fn() },
  },
}));

describe("todayInTimeZone", () => {
  it("returns the local calendar day as UTC midnight", () => {
    // 22:30 UTC on the 4th is already the 5th in Dubai (UTC+4).
    const now = new Date("2026-11-04T22:30:00Z");
    expect(todayInTimeZone(now, "Asia/Dubai").toISOString()).toBe(
      "2026-11-05T00:00:00.000Z"
    );
    expect(todayInTimeZone(now, "UTC").toISOString()).toBe(
      "2026-11-04T00:00:00.000Z"
    );
  });

  it("falls back to UTC for an unknown time zone", () => {
    const now = new Date("2026-11-04T22:30:00Z");
    expect(todayInTimeZone(now, "Not/AZone").toISOString()).toBe(
      "2026-11-04T00:00:00.000Z"
    );
  });
});

describe("utcDayRange / targetDayForLead", () => {
  it("builds half-open day ranges and lead offsets", () => {
    const today = new Date("2026-11-04T00:00:00Z");
    expect(utcDayRange(today)).toEqual({
      gte: today,
      lt: new Date("2026-11-05T00:00:00Z"),
    });
    expect(targetDayForLead(today, 7).toISOString()).toBe(
      "2026-11-11T00:00:00.000Z"
    );
  });
});

describe("resolveAlertRecipients", () => {
  beforeEach(() => vi.resetAllMocks());

  it("merges owner, team approver and admins without duplicates", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "admin-1" },
      { id: "owner-1" },
    ] as never);
    vi.mocked(prisma.team.findFirst).mockResolvedValue({
      approverId: "approver-1",
    } as never);
    const ids = await resolveAlertRecipients("org-1", {
      ownerId: "owner-1",
      teamId: "team-1",
    });
    expect(ids).toEqual(["owner-1", "approver-1", "admin-1"]);
  });

  it("can exclude admins and tolerates missing owner/team", async () => {
    vi.mocked(prisma.team.findFirst).mockResolvedValue(null);
    const ids = await resolveAlertRecipients(
      "org-1",
      { ownerId: null, teamId: null },
      { includeAdmins: false }
    );
    expect(ids).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe("recordDispatchOnce", () => {
  beforeEach(() => vi.resetAllMocks());
  const input = {
    organizationId: "org-1",
    subscriptionId: "sub-1",
    kind: "NOTICE_PERIOD" as const,
    leadDays: 7,
    targetDate: new Date("2026-11-11T00:00:00Z"),
    recipientCount: 0,
  };

  it("creates a row the first time and skips afterwards", async () => {
    vi.mocked(prisma.reminderDispatch.findUnique).mockResolvedValueOnce(null);
    expect(await recordDispatchOnce(input)).toBe(true);
    expect(prisma.reminderDispatch.create).toHaveBeenCalledWith({
      data: input,
    });

    vi.mocked(prisma.reminderDispatch.findUnique).mockResolvedValueOnce({
      id: "x",
    } as never);
    expect(await recordDispatchOnce(input)).toBe(false);
  });

  it("treats a unique-constraint race as already sent", async () => {
    vi.mocked(prisma.reminderDispatch.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.reminderDispatch.create).mockRejectedValue(
      Object.assign(new Error("dup"), { code: "P2002" })
    );
    expect(await recordDispatchOnce(input)).toBe(false);
  });
});
