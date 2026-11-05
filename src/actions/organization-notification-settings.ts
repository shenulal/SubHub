// src/actions/organization-notification-settings.ts
"use server";

import { auth } from "@/lib/auth";
import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { getSetting } from "@/lib/settings/service";
import { revalidatePath } from "next/cache";

// Type definitions
export interface NotificationSettings {
  emailEnabled: boolean;
  renewalAlertDays: number[];
  offboardingAlerts: boolean;
  weeklyDigest: boolean;
  shadowITAlerts: boolean;
  costAnomalyAlerts: boolean;
  costAnomalyThreshold: number; // percent (default 50%)
}

interface OrganizationSettings {
  notifications?: NotificationSettings;
  [key: string]: unknown;
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  emailEnabled: true,
  renewalAlertDays: [30],
  offboardingAlerts: true,
  weeklyDigest: false,
  shadowITAlerts: true,
  costAnomalyAlerts: true,
  costAnomalyThreshold: 50,
};

/**
 * Get organization notification settings
 */
export async function getOrganizationNotificationSettings(): Promise<NotificationSettings> {
  const { organizationId } = await requireOrganization();

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });

  if (!organization) {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }

  const settings = organization.settings as OrganizationSettings;
  const notifications = settings?.notifications;

  if (!notifications) {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }

  return {
    emailEnabled:
      notifications.emailEnabled ?? DEFAULT_NOTIFICATION_SETTINGS.emailEnabled,
    renewalAlertDays:
      notifications.renewalAlertDays ??
      DEFAULT_NOTIFICATION_SETTINGS.renewalAlertDays,
    offboardingAlerts:
      notifications.offboardingAlerts ??
      DEFAULT_NOTIFICATION_SETTINGS.offboardingAlerts,
    weeklyDigest:
      notifications.weeklyDigest ?? DEFAULT_NOTIFICATION_SETTINGS.weeklyDigest,
    shadowITAlerts:
      notifications.shadowITAlerts ??
      DEFAULT_NOTIFICATION_SETTINGS.shadowITAlerts,
    costAnomalyAlerts:
      notifications.costAnomalyAlerts ??
      DEFAULT_NOTIFICATION_SETTINGS.costAnomalyAlerts,
    costAnomalyThreshold:
      notifications.costAnomalyThreshold ??
      DEFAULT_NOTIFICATION_SETTINGS.costAnomalyThreshold,
  };
}

/**
 * Renewal-alert lead times offered in the organisation notification settings,
 * resolved from `subscriptions.reminderLeadDayOptions` (editable in Settings).
 */
export async function getRenewalAlertDayOptions(): Promise<number[]> {
  const { organizationId } = await requireOrganization();
  const options = await getSetting(
    organizationId,
    "subscriptions.reminderLeadDayOptions"
  );
  return [...options].sort((a, b) => a - b);
}

/**
 * Update organization notification settings
 */
async function _updateOrganizationNotificationSettings(
  updates: Partial<NotificationSettings>
): Promise<{ success: boolean; message?: string }> {
  const session = await auth();

  if (!session?.user) {
    const { redirect } = await import("next/navigation");
    return redirect("/login");
  }

  const user = session.user;
  const organizationId = user.organizationId;

  if (!organizationId) {
    const { redirect } = await import("next/navigation");
    return redirect("/onboarding");
  }

  // Check admin permission
  if (user.role !== "ADMIN") {
    return {
      success: false,
      message: "Admin permission required",
    };
  }

  // Fetch current settings
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });

  const currentSettings = (organization?.settings ||
    {}) as OrganizationSettings;
  const currentNotifications =
    currentSettings.notifications || DEFAULT_NOTIFICATION_SETTINGS;

  // Updated notification settings
  const updatedNotifications = {
    emailEnabled: updates.emailEnabled ?? currentNotifications.emailEnabled,
    renewalAlertDays:
      updates.renewalAlertDays ?? currentNotifications.renewalAlertDays,
    offboardingAlerts:
      updates.offboardingAlerts ?? currentNotifications.offboardingAlerts,
    weeklyDigest: updates.weeklyDigest ?? currentNotifications.weeklyDigest,
    shadowITAlerts:
      updates.shadowITAlerts ?? currentNotifications.shadowITAlerts,
    costAnomalyAlerts:
      updates.costAnomalyAlerts ?? currentNotifications.costAnomalyAlerts,
    costAnomalyThreshold:
      updates.costAnomalyThreshold ?? currentNotifications.costAnomalyThreshold,
  };

  // Build settings data
  const newSettings = {
    ...currentSettings,
    notifications: updatedNotifications,
  };

  // Update settings
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: newSettings as any,
    },
  });

  revalidatePath("/settings/notifications");

  return { success: true };
}
export const updateOrganizationNotificationSettings = withLogging(
  "updateOrganizationNotificationSettings",
  _updateOrganizationNotificationSettings
);
