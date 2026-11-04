// src/actions/notifications/org-defaults.ts
"use server";

/**
 * Organisation-level notification defaults (admin section of
 * /settings/notifications). Values that overlap the settings registry live
 * there (`notifications.digest*`, `discovery.costAnomalyThresholdPercent`,
 * quiet hours, channels, approver copy); the remaining legacy on/off flags
 * stay on `Organization.settings.notifications` because the scans read them.
 */
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import { readLegacyFlags } from "@/lib/services/notification/legacy-alerts";
import type { SettingKey } from "@/lib/settings/registry";
import {
  SettingValidationError,
  getSettings,
  setOrganizationSettings,
} from "@/lib/settings/service";
import {
  organizationNotificationDefaultsSchema,
  type OrganizationNotificationDefaultsInput,
} from "@/lib/validations/notifications";
import type { ActionState } from "@/types";
import type { NotificationChannel, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { toActionError } from "./shared";

const SETTINGS_PATH = "/settings/notifications";
const PERMISSION = "settings:manage" as const;

export interface OrganizationNotificationDefaults {
  digestEnabled: boolean;
  digestWeekday: number;
  digestTime: string;
  costAnomalyThresholdPercent: number;
  copyApproversOnRenewal: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  enabledChannels: NotificationChannel[];
  offboardingAlerts: boolean;
  shadowITAlerts: boolean;
  costAnomalyAlerts: boolean;
}

const REGISTRY_FIELD_MAP: Record<
  keyof Pick<
    OrganizationNotificationDefaults,
    | "digestEnabled"
    | "digestWeekday"
    | "digestTime"
    | "costAnomalyThresholdPercent"
    | "copyApproversOnRenewal"
    | "quietHoursStart"
    | "quietHoursEnd"
    | "enabledChannels"
  >,
  SettingKey
> = {
  digestEnabled: "notifications.digestEnabled",
  digestWeekday: "notifications.digestWeekday",
  digestTime: "notifications.digestTime",
  costAnomalyThresholdPercent: "discovery.costAnomalyThresholdPercent",
  copyApproversOnRenewal: "notifications.copyApproversOnRenewal",
  quietHoursStart: "notifications.quietHoursStart",
  quietHoursEnd: "notifications.quietHoursEnd",
  enabledChannels: "notifications.enabledChannels",
};

const LEGACY_FLAG_FIELDS = [
  "offboardingAlerts",
  "shadowITAlerts",
  "costAnomalyAlerts",
] as const;

async function loadDefaults(
  organizationId: string
): Promise<OrganizationNotificationDefaults> {
  const [settings, legacy] = await Promise.all([
    getSettings(organizationId, Object.values(REGISTRY_FIELD_MAP)),
    readLegacyFlags(organizationId),
  ]);
  return {
    digestEnabled: settings["notifications.digestEnabled"],
    digestWeekday: settings["notifications.digestWeekday"],
    digestTime: settings["notifications.digestTime"],
    costAnomalyThresholdPercent:
      settings["discovery.costAnomalyThresholdPercent"],
    copyApproversOnRenewal: settings["notifications.copyApproversOnRenewal"],
    quietHoursStart: settings["notifications.quietHoursStart"],
    quietHoursEnd: settings["notifications.quietHoursEnd"],
    enabledChannels: settings[
      "notifications.enabledChannels"
    ] as NotificationChannel[],
    offboardingAlerts: legacy.offboardingAlerts,
    shadowITAlerts: legacy.shadowITAlerts,
    costAnomalyAlerts: legacy.costAnomalyAlerts,
  };
}

async function _getOrganizationNotificationDefaults(): Promise<
  ActionState<OrganizationNotificationDefaults>
> {
  try {
    const { organizationId } = await requirePermission("settings:read");
    return { success: true, data: await loadDefaults(organizationId) };
  } catch (error) {
    return toActionError(error, "getOrganizationNotificationDefaults");
  }
}
export const getOrganizationNotificationDefaults = withLogging(
  "getOrganizationNotificationDefaults",
  _getOrganizationNotificationDefaults
);

async function saveLegacyFlags(
  organizationId: string,
  input: OrganizationNotificationDefaultsInput
): Promise<void> {
  const updates = Object.fromEntries(
    LEGACY_FLAG_FIELDS.filter((k) => input[k] !== undefined).map((k) => [
      k,
      input[k],
    ])
  );
  if (Object.keys(updates).length === 0) return;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const current =
    org?.settings &&
    typeof org.settings === "object" &&
    !Array.isArray(org.settings)
      ? (org.settings as Record<string, unknown>)
      : {};
  const notifications =
    current.notifications && typeof current.notifications === "object"
      ? (current.notifications as Record<string, unknown>)
      : {};
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      settings: {
        ...current,
        notifications: { ...notifications, ...updates },
      } as Prisma.InputJsonValue,
    },
  });
}

async function _updateOrganizationNotificationDefaults(
  input: OrganizationNotificationDefaultsInput
): Promise<ActionState<OrganizationNotificationDefaults>> {
  try {
    const { organizationId, userId } = await requirePermission(PERMISSION);
    const parsed = organizationNotificationDefaultsSchema.parse(input);

    const registryValues: Partial<Record<SettingKey, unknown>> = {};
    for (const [field, key] of Object.entries(REGISTRY_FIELD_MAP)) {
      const value = parsed[field as keyof typeof REGISTRY_FIELD_MAP];
      if (value !== undefined) registryValues[key] = value;
    }
    if (Object.keys(registryValues).length > 0) {
      await setOrganizationSettings(organizationId, registryValues, userId);
    }
    await saveLegacyFlags(organizationId, parsed);

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: "UPDATE_NOTIFICATION_DEFAULTS",
        entityType: "OrganizationSetting",
        entityId: organizationId,
        changes: parsed as Prisma.InputJsonValue,
      },
    });
    revalidatePath(SETTINGS_PATH);
    return {
      success: true,
      data: await loadDefaults(organizationId),
      message: "Organisation defaults saved",
    };
  } catch (error) {
    if (error instanceof SettingValidationError) {
      return { success: false, error: error.message, message: error.message };
    }
    return toActionError(error, "updateOrganizationNotificationDefaults");
  }
}
export const updateOrganizationNotificationDefaults = withLogging(
  "updateOrganizationNotificationDefaults",
  _updateOrganizationNotificationDefaults
);
