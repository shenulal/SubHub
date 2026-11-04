// src/actions/notifications/org-defaults.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: { create: vi.fn() },
    organization: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/rbac/service", () => {
  class ForbiddenError extends Error {}
  return {
    requirePermission: vi.fn(),
    isForbiddenError: (e: unknown) => e instanceof ForbiddenError,
    ForbiddenError,
  };
});
vi.mock("@/lib/settings/service", () => {
  class SettingValidationError extends Error {}
  return {
    getSettings: vi.fn(),
    setOrganizationSettings: vi.fn(),
    SettingValidationError,
  };
});
vi.mock("@/lib/services/notification/legacy-alerts", () => ({
  readLegacyFlags: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/service";
import { readLegacyFlags } from "@/lib/services/notification/legacy-alerts";
import { getSettings, setOrganizationSettings } from "@/lib/settings/service";
import {
  getOrganizationNotificationDefaults,
  updateOrganizationNotificationDefaults,
} from "./org-defaults";

const ctx = {
  userId: "admin",
  organizationId: "org-1",
  role: "ADMIN",
  permissions: new Set(),
};
const registry = {
  "notifications.digestEnabled": true,
  "notifications.digestWeekday": 1,
  "notifications.digestTime": "08:00",
  "discovery.costAnomalyThresholdPercent": 50,
  "notifications.copyApproversOnRenewal": true,
  "notifications.quietHoursStart": null,
  "notifications.quietHoursEnd": null,
  "notifications.enabledChannels": ["IN_APP", "EMAIL"],
};

describe("organisation notification defaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockResolvedValue(ctx as never);
    vi.mocked(getSettings).mockResolvedValue(registry as never);
    vi.mocked(readLegacyFlags).mockResolvedValue({
      renewalAlertDays: [30],
      offboardingAlerts: true,
      shadowITAlerts: false,
      costAnomalyAlerts: true,
    });
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      settings: { notifications: { shadowITAlerts: false } },
    } as never);
  });

  it("merges registry values and legacy flags", async () => {
    const res = await getOrganizationNotificationDefaults();
    expect(requirePermission).toHaveBeenCalledWith("settings:read");
    expect(res.data).toMatchObject({
      digestWeekday: 1,
      costAnomalyThresholdPercent: 50,
      shadowITAlerts: false,
      offboardingAlerts: true,
    });
  });

  it("writes overlapping values to the registry and legacy flags to organisation JSON", async () => {
    const res = await updateOrganizationNotificationDefaults({
      digestWeekday: 3,
      costAnomalyThresholdPercent: 75,
      shadowITAlerts: true,
    });

    expect(requirePermission).toHaveBeenCalledWith("settings:manage");
    expect(setOrganizationSettings).toHaveBeenCalledWith(
      "org-1",
      {
        "notifications.digestWeekday": 3,
        "discovery.costAnomalyThresholdPercent": 75,
      },
      "admin"
    );
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { settings: { notifications: { shadowITAlerts: true } } },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "UPDATE_NOTIFICATION_DEFAULTS" }),
    });
    expect(res.success).toBe(true);
  });

  it("skips registry/legacy writes when nothing relevant changed", async () => {
    await updateOrganizationNotificationDefaults({});
    expect(setOrganizationSettings).not.toHaveBeenCalled();
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("rejects invalid times", async () => {
    const res = await updateOrganizationNotificationDefaults({
      digestTime: "25:99",
    });
    expect(res.success).toBe(false);
    expect(setOrganizationSettings).not.toHaveBeenCalled();
  });
});
