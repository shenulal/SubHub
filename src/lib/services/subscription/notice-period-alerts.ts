// src/lib/services/subscription/notice-period-alerts.ts
/**
 * Notice-period alerts: for ACTIVE subscriptions with a cancellation deadline,
 * notify the owner, team approver and admins `lead` days before the deadline
 * (leads from `subscriptions.noticePeriodAlertLeadDays`, org time zone from
 * `general.timezone`). One ReminderDispatch per (subscription, lead, deadline).
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { notify } from "@/lib/services/notification/center";
import { getSettings } from "@/lib/settings/service";

import {
  emptyScanResult,
  listOrganizationIds,
  recordDispatchOnce,
  resolveAlertRecipients,
  targetDayForLead,
  todayInTimeZone,
  utcDayRange,
  type ScanResult,
} from "./alert-support";
import { toIsoDate } from "./contract-terms";

async function processLead(
  organizationId: string,
  today: Date,
  leadDays: number,
  result: ScanResult
): Promise<void> {
  const targetDay = targetDayForLead(today, leadDays);
  const subscriptions = await prisma.subscription.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      cancellationDeadline: utcDayRange(targetDay),
    },
    select: {
      id: true,
      ownerId: true,
      teamId: true,
      cancellationDeadline: true,
      endDate: true,
      noticePeriodDays: true,
      app: { select: { name: true } },
    },
  });

  for (const sub of subscriptions) {
    result.matched++;
    const deadline = sub.cancellationDeadline ?? targetDay;
    const recorded = await recordDispatchOnce({
      organizationId,
      subscriptionId: sub.id,
      kind: "NOTICE_PERIOD",
      leadDays,
      targetDate: targetDay,
      recipientCount: 0,
    });
    if (!recorded) {
      result.skipped++;
      continue;
    }
    const recipients = await resolveAlertRecipients(organizationId, sub);
    const deadlineIso = toIsoDate(deadline);
    const title =
      leadDays === 0
        ? `Cancellation deadline today: ${sub.app.name}`
        : `${sub.app.name}: cancel by ${deadlineIso} (${leadDays} day${leadDays === 1 ? "" : "s"} left)`;
    await notify({
      organizationId,
      userIds: recipients,
      type: "NOTICE_PERIOD",
      title,
      body: sub.endDate
        ? `Contract ends ${toIsoDate(sub.endDate)} with a ${sub.noticePeriodDays ?? 0}-day notice period.`
        : undefined,
      link: `/subscriptions/${sub.id}?tab=cancellation`,
      dedupeKey: `notice:${sub.id}:${deadlineIso}:${leadDays}`,
      metadata: { subscriptionId: sub.id, leadDays, deadline: deadlineIso },
    });
    await prisma.reminderDispatch.updateMany({
      where: {
        subscriptionId: sub.id,
        kind: "NOTICE_PERIOD",
        leadDays,
        targetDate: targetDay,
      },
      data: { recipientCount: recipients.length },
    });
    result.notified++;
  }
}

export async function processNoticePeriodAlerts(
  now: Date = new Date()
): Promise<ScanResult> {
  const result = emptyScanResult();
  const organizationIds = await listOrganizationIds();
  for (const organizationId of organizationIds) {
    result.processedOrganizations++;
    try {
      const settings = await getSettings(organizationId, [
        "subscriptions.noticePeriodAlertLeadDays",
        "general.timezone",
      ]);
      const today = todayInTimeZone(now, settings["general.timezone"]);
      const leads = Array.from(
        new Set(settings["subscriptions.noticePeriodAlertLeadDays"])
      );
      for (const lead of leads) {
        await processLead(organizationId, today, lead, result);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      logger.error(
        { err: error, organizationId },
        "notice-period alerts failed"
      );
      result.errors.push(`${organizationId}: ${message}`);
    }
  }
  return result;
}
