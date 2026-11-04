// src/actions/notifications/preferences.ts
"use server";

import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import {
  PreferenceValidationError,
  getPreferenceMatrix,
  savePreferenceCells,
  saveUserReminderLeadDays,
} from "@/lib/services/notification/preferences";
import {
  updatePreferencesSchema,
  type UpdatePreferencesInput,
} from "@/lib/validations/notifications";
import type { ActionState } from "@/types";
import type { NotificationPreferenceMatrix } from "@/types/notification";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { toActionError } from "./shared";

const SETTINGS_PATH = "/settings/notifications";
const PERMISSION = "notifications:manage_own" as const;

async function _getNotificationPreferences(): Promise<
  ActionState<NotificationPreferenceMatrix>
> {
  try {
    const { userId, organizationId } = await requirePermission(PERMISSION);
    const data = await getPreferenceMatrix(organizationId, userId);
    return { success: true, data };
  } catch (error) {
    return toActionError(error, "getNotificationPreferences");
  }
}
export const getNotificationPreferences = withLogging(
  "getNotificationPreferences",
  _getNotificationPreferences
);

async function _updateNotificationPreferences(
  input: UpdatePreferencesInput
): Promise<ActionState<NotificationPreferenceMatrix>> {
  try {
    const { userId, organizationId } = await requirePermission(PERMISSION);
    const parsed = updatePreferencesSchema.parse(input);

    const changes: Record<string, unknown> = {};
    if (parsed.cells && parsed.cells.length > 0) {
      changes.cells = await savePreferenceCells(userId, parsed.cells);
    }
    if (parsed.reminderLeadDays) {
      changes.reminderLeadDays = await saveUserReminderLeadDays(
        organizationId,
        userId,
        parsed.reminderLeadDays
      );
    }

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: "UPDATE_NOTIFICATION_PREFERENCES",
        entityType: "NotificationPreference",
        entityId: userId,
        changes: {
          ...changes,
          cells: parsed.cells ?? [],
        } as Prisma.InputJsonValue,
      },
    });
    revalidatePath(SETTINGS_PATH);
    const data = await getPreferenceMatrix(organizationId, userId);
    return { success: true, data, message: "Preferences saved" };
  } catch (error) {
    if (error instanceof PreferenceValidationError) {
      return { success: false, error: error.message, message: error.message };
    }
    return toActionError(error, "updateNotificationPreferences");
  }
}
export const updateNotificationPreferences = withLogging(
  "updateNotificationPreferences",
  _updateNotificationPreferences
);
