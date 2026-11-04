// src/actions/in-app-notifications.ts
"use server";

import { requireOrganization } from "@/lib/auth/require-auth";
import {
  computeLegacyAlerts,
  type InAppNotification,
  type InAppNotificationType,
} from "@/lib/services/notification/legacy-alerts";

export type { InAppNotification, InAppNotificationType };

/**
 * Legacy computed alerts (session-bound). Kept for backwards compatibility;
 * the bell and centre now read persistent `Notification` rows and the
 * reminders cron migrates these through `backfillComputedAlerts()`.
 */
export async function getInAppNotifications(): Promise<InAppNotification[]> {
  const { organizationId } = await requireOrganization();
  return computeLegacyAlerts(organizationId);
}
