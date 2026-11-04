// src/lib/services/notification/backfill.ts
/**
 * One-time (idempotent) migration of the legacy computed alerts
 * (`getInAppNotifications` in `src/actions/in-app-notifications.ts`) into
 * persistent `Notification` rows. Dedupe keys are derived from the legacy ids
 * so repeated cron runs never duplicate anything.
 */
import type { NotificationEventType } from "@prisma/client";
import { getOrganizationAdminIds, notify } from "./center";
import {
  computeLegacyAlerts,
  type InAppNotification,
  type InAppNotificationType,
} from "./legacy-alerts";

const LEGACY_TYPE_MAP: Record<InAppNotificationType, NotificationEventType> = {
  renewal: "RENEWAL_REMINDER",
  offboarding: "OFFBOARDING",
  shadowIT: "SHADOW_IT",
  costAnomaly: "COST_ANOMALY",
  pendingReview: "PENDING_REVIEW",
};

const LEGACY_TITLE: Record<
  InAppNotificationType,
  (a: InAppNotification) => string
> = {
  renewal: (a) => `Renewal approaching: ${a.title}`,
  offboarding: (a) => `Unrevoked access for ${a.title}`,
  shadowIT: (a) => `Unapproved app detected: ${a.title}`,
  costAnomaly: (a) => `Cost increase for ${a.title} (${a.detail})`,
  pendingReview: (a) => `${a.title} app(s) awaiting review (${a.detail})`,
};

export interface BackfillResult {
  organizationId: string;
  legacyAlerts: number;
  created: number;
  deduped: number;
}

/** Stable key: legacy id + calendar day for renewals (they repeat daily). */
export function legacyDedupeKey(alert: InAppNotification): string {
  const day = alert.createdAt.toISOString().slice(0, 10);
  return alert.type === "renewal"
    ? `legacy:${alert.id}:${day}`
    : `legacy:${alert.id}`;
}

export async function backfillComputedAlerts(
  organizationId: string,
  now: Date = new Date()
): Promise<BackfillResult> {
  const [alerts, adminIds] = await Promise.all([
    computeLegacyAlerts(organizationId),
    getOrganizationAdminIds(organizationId),
  ]);
  const result: BackfillResult = {
    organizationId,
    legacyAlerts: alerts.length,
    created: 0,
    deduped: 0,
  };
  if (adminIds.length === 0) return result;

  for (const alert of alerts) {
    const res = await notify({
      organizationId,
      userIds: adminIds,
      type: LEGACY_TYPE_MAP[alert.type],
      title: LEGACY_TITLE[alert.type](alert),
      body: alert.detail,
      link: alert.link,
      dedupeKey: legacyDedupeKey(alert),
      channels: ["IN_APP"],
      metadata: { source: "legacy-backfill", legacyId: alert.id },
      now,
    });
    result.created += res.inAppCreated;
    result.deduped += res.deduped;
  }
  return result;
}
