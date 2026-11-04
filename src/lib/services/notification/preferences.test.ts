// src/lib/services/notification/preferences.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    notificationPreference: { findMany: vi.fn(), upsert: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));
vi.mock("@/lib/settings/service", () => ({ getSettings: vi.fn() }));

import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings/service";
import { ALL_NOTIFICATION_EVENT_TYPES } from "@/types/notification";
import {
  PreferenceValidationError,
  getPreferenceMatrix,
  readUserReminderLeadDays,
  savePreferenceCells,
  saveUserReminderLeadDays,
} from "./preferences";

describe("preferences service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSettings).mockResolvedValue({
      "notifications.enabledChannels": ["IN_APP", "EMAIL"],
      "subscriptions.reminderLeadDayOptions": [1, 3, 7, 14, 30],
      "subscriptions.defaultReminderLeadDays": [7, 3, 1],
    } as never);
  });

  it("reads personal lead days from User.preferences", () => {
    expect(readUserReminderLeadDays({ reminderLeadDays: [14, 7] })).toEqual([
      14, 7,
    ]);
    expect(readUserReminderLeadDays({ reminderLeadDays: [] })).toBeNull();
    expect(readUserReminderLeadDays({})).toBeNull();
    expect(readUserReminderLeadDays(null)).toBeNull();
    expect(readUserReminderLeadDays("x" as never)).toBeNull();
  });

  it("builds the full matrix with stored overrides and defaults", async () => {
    vi.mocked(prisma.notificationPreference.findMany).mockResolvedValue([
      { eventType: "DIGEST", channel: "EMAIL", enabled: false },
    ] as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      preferences: { reminderLeadDays: [14] },
    } as never);

    const matrix = await getPreferenceMatrix("org-1", "u1");

    expect(matrix.channels).toEqual(["IN_APP", "EMAIL"]);
    expect(matrix.cells).toHaveLength(ALL_NOTIFICATION_EVENT_TYPES.length * 2);
    expect(
      matrix.cells.find(
        (c) => c.eventType === "DIGEST" && c.channel === "EMAIL"
      )?.enabled
    ).toBe(false);
    expect(
      matrix.cells.find(
        (c) => c.eventType === "DIGEST" && c.channel === "IN_APP"
      )?.enabled
    ).toBe(true);
    expect(matrix.reminderLeadDays).toEqual([14]);
    expect(matrix.organizationDefaultLeadDays).toEqual([7, 3, 1]);
  });

  it("falls back to the organisation default lead days", async () => {
    vi.mocked(prisma.notificationPreference.findMany).mockResolvedValue([]);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      preferences: {},
    } as never);
    const matrix = await getPreferenceMatrix("org-1", "u1");
    expect(matrix.reminderLeadDays).toEqual([7, 3, 1]);
  });

  it("upserts cells in one transaction", async () => {
    const n = await savePreferenceCells("u1", [
      { eventType: "DIGEST", channel: "EMAIL", enabled: false },
      { eventType: "RENEWAL_REMINDER", channel: "PUSH", enabled: true },
    ]);
    expect(n).toBe(2);
    expect(prisma.notificationPreference.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(await savePreferenceCells("u1", [])).toBe(0);
  });

  it("validates lead days against the organisation options and merges into preferences", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      preferences: { theme: "dark" },
    } as never);

    const saved = await saveUserReminderLeadDays("org-1", "u1", [7, 1, 7]);

    expect(saved).toEqual([7, 1]);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { preferences: { theme: "dark", reminderLeadDays: [7, 1] } },
    });
  });

  it("rejects lead days not offered", async () => {
    await expect(
      saveUserReminderLeadDays("org-1", "u1", [5])
    ).rejects.toBeInstanceOf(PreferenceValidationError);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
