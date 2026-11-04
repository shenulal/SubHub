// src/lib/services/notification/center.ts
/**
 * Unified notification dispatch (foundation version).
 *
 * `notify()` is the single entry point every feature uses to reach a member:
 *  - writes a persistent in-app `Notification` row per recipient (deduped by `dedupeKey`)
 *  - sends an email when the recipient allows the EMAIL channel for the event and the
 *    caller supplies `email` content
 *  - PUSH delivery is recorded as a TODO until the mobile client ships (DeviceToken rows)
 *
 * Preferences: `NotificationPreference` rows; absence of a row means enabled.
 * Organisation-level channel availability: settings key `notifications.enabledChannels`.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSetting } from "@/lib/settings/service";
import type {
  NotificationChannel,
  NotificationEventType,
  Prisma,
} from "@prisma/client";
import { EmailConfig, getResendClient } from "./email.utils";

export interface NotifyEmailContent {
  subject: string;
  html: string;
  text?: string;
}

export interface NotifyInput {
  organizationId: string;
  /** Recipients (user ids inside the organisation) */
  userIds: string[];
  type: NotificationEventType;
  title: string;
  body?: string;
  link?: string;
  /** Stable key per (user, event) to avoid duplicates, e.g. `renewal:<subId>:<date>:7` */
  dedupeKey?: string;
  metadata?: Prisma.InputJsonValue;
  email?: NotifyEmailContent;
}

export interface NotifyResult {
  inAppCreated: number;
  emailsSent: number;
  skipped: number;
}

async function loadPreferences(userIds: string[], type: NotificationEventType) {
  const rows = await prisma.notificationPreference.findMany({
    where: { userId: { in: userIds }, eventType: type },
    select: { userId: true, channel: true, enabled: true },
  });
  const map = new Map<string, Map<NotificationChannel, boolean>>();
  for (const r of rows) {
    if (!map.has(r.userId)) map.set(r.userId, new Map());
    map.get(r.userId)!.set(r.channel, r.enabled);
  }
  return (userId: string, channel: NotificationChannel) =>
    map.get(userId)?.get(channel) ?? true;
}

export async function notify(input: NotifyInput): Promise<NotifyResult> {
  const uniqueUserIds = Array.from(new Set(input.userIds)).filter(Boolean);
  if (uniqueUserIds.length === 0)
    return { inAppCreated: 0, emailsSent: 0, skipped: 0 };

  const [enabledChannels, allows] = await Promise.all([
    getSetting(input.organizationId, "notifications.enabledChannels"),
    loadPreferences(uniqueUserIds, input.type),
  ]);

  let skipped = 0;
  const inAppRecipients = uniqueUserIds.filter((id) => {
    const ok = enabledChannels.includes("IN_APP") && allows(id, "IN_APP");
    if (!ok) skipped++;
    return ok;
  });

  const created = inAppRecipients.length
    ? await prisma.notification.createMany({
        data: inAppRecipients.map((userId) => ({
          organizationId: input.organizationId,
          userId,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          link: input.link ?? null,
          dedupeKey: input.dedupeKey ? `${input.dedupeKey}` : null,
          metadata: input.metadata,
        })),
        skipDuplicates: true,
      })
    : { count: 0 };

  let emailsSent = 0;
  if (input.email && enabledChannels.includes("EMAIL")) {
    const emailRecipients = uniqueUserIds.filter((id) => allows(id, "EMAIL"));
    if (emailRecipients.length) {
      const users = await prisma.user.findMany({
        where: { id: { in: emailRecipients }, status: "ACTIVE" },
        select: { email: true },
      });
      const fromName = await getSetting(
        input.organizationId,
        "notifications.emailFromName"
      );
      for (const u of users) {
        try {
          await getResendClient().emails.send({
            from: `${fromName || EmailConfig.fromName} <${EmailConfig.fromEmail}>`,
            to: u.email,
            subject: input.email.subject,
            html: input.email.html,
            text: input.email.text,
          });
          emailsSent++;
        } catch (error) {
          logger.warn(
            { err: error, to: u.email, type: input.type },
            "[notify] email failed"
          );
        }
      }
    }
  }

  // TODO(notifications): PUSH delivery via DeviceToken rows once the mobile client exists.
  return { inAppCreated: created.count, emailsSent, skipped };
}

/** Admin + approver user ids for an organisation (common escalation audience). */
export async function getOrganizationAdminIds(
  organizationId: string
): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { organizationId, status: "ACTIVE", role: { in: ["ADMIN"] } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
