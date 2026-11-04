// src/actions/notifications/preferences.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: { auditLog: { create: vi.fn() } } }));
vi.mock("@/lib/rbac/service", () => {
  class ForbiddenError extends Error {}
  return {
    requirePermission: vi.fn(),
    isForbiddenError: (e: unknown) => e instanceof ForbiddenError,
    ForbiddenError,
  };
});
vi.mock("@/lib/services/notification/preferences", () => {
  class PreferenceValidationError extends Error {}
  return {
    PreferenceValidationError,
    getPreferenceMatrix: vi.fn(),
    savePreferenceCells: vi.fn(),
    saveUserReminderLeadDays: vi.fn(),
  };
});

import { prisma } from "@/lib/db";
import { ForbiddenError, requirePermission } from "@/lib/rbac/service";
import {
  PreferenceValidationError,
  getPreferenceMatrix,
  savePreferenceCells,
  saveUserReminderLeadDays,
} from "@/lib/services/notification/preferences";
import { revalidatePath } from "next/cache";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "./preferences";

const ctx = {
  userId: "u1",
  organizationId: "org-1",
  role: "MEMBER",
  permissions: new Set(),
};
const matrix = {
  channels: ["IN_APP"],
  cells: [],
  reminderLeadDays: [7],
  reminderLeadDayOptions: [1, 7],
  organizationDefaultLeadDays: [7],
};

describe("preference actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockResolvedValue(ctx as never);
    vi.mocked(getPreferenceMatrix).mockResolvedValue(matrix as never);
  });

  it("reads the matrix with notifications:manage_own", async () => {
    const res = await getNotificationPreferences();
    expect(requirePermission).toHaveBeenCalledWith("notifications:manage_own");
    expect(res).toEqual({ success: true, data: matrix });
  });

  it("saves cells + lead days, audits and revalidates", async () => {
    vi.mocked(savePreferenceCells).mockResolvedValue(1);
    vi.mocked(saveUserReminderLeadDays).mockResolvedValue([7]);

    const res = await updateNotificationPreferences({
      cells: [{ eventType: "DIGEST", channel: "EMAIL", enabled: false }],
      reminderLeadDays: [7],
    });

    expect(savePreferenceCells).toHaveBeenCalledWith("u1", [
      { eventType: "DIGEST", channel: "EMAIL", enabled: false },
    ]);
    expect(saveUserReminderLeadDays).toHaveBeenCalledWith("org-1", "u1", [7]);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "UPDATE_NOTIFICATION_PREFERENCES",
        userId: "u1",
        organizationId: "org-1",
      }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/settings/notifications");
    expect(res.success).toBe(true);
    expect(res.data).toEqual(matrix);
  });

  it("rejects invalid input", async () => {
    const res = await updateNotificationPreferences({
      cells: [{ eventType: "NOPE" as never, channel: "EMAIL", enabled: true }],
    });
    expect(res.success).toBe(false);
    expect(savePreferenceCells).not.toHaveBeenCalled();
  });

  it("surfaces lead-day validation errors", async () => {
    vi.mocked(saveUserReminderLeadDays).mockRejectedValue(
      new PreferenceValidationError("Lead days not offered: 5")
    );
    const res = await updateNotificationPreferences({ reminderLeadDays: [5] });
    expect(res).toMatchObject({
      success: false,
      error: "Lead days not offered: 5",
    });
  });

  it("maps forbidden", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new ForbiddenError("x"));
    const res = await updateNotificationPreferences({ reminderLeadDays: [7] });
    expect(res.success).toBe(false);
  });
});
