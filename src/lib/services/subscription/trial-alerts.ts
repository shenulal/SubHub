// src/lib/services/subscription/trial-alerts.ts
/**
 * Trial-ending alerts: `isTrial && trialEndsAt` subscriptions are announced to
 * the owner (+ admins) `lead` days before the trial ends
 * (`subscriptions.trialAlertLeadDays`). Trials that have passed their end date
 * with auto-renewal on are flipped to paid (`isTrial = false`) with an audit entry.
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

export interface TrialScanResult extends ScanResult {
  converted: number;
}

async function processLead(
  organizationId: string,
  today: Date,
  leadDays: number,
  result: TrialScanResult
): Promise<void> {
  const targetDay = targetDayForLead(today, leadDays);
  const trials = await prisma.subscription.findMany({
    where: {
      organizationId,
      isTrial: true,
      status: { in: ["ACTIVE", "PENDING"] },
      trialEndsAt: utcDayRange(targetDay),
    },
    select: {
      id: true,
      ownerId: true,
      teamId: true,
      trialEndsAt: true,
      autoRenewal: true,
      amount: true,
      currency: true,
      app: { select: { name: true } },
    },
  });

  for (const trial of trials) {
    result.matched++;
    const recorded = await recordDispatchOnce({
      organizationId,
      subscriptionId: trial.id,
      kind: "TRIAL_ENDING",
      leadDays,
      targetDate: targetDay,
      recipientCount: 0,
    });
    if (!recorded) {
      result.skipped++;
      continue;
    }
    const recipients = await resolveAlertRecipients(organizationId, trial);
    const endsIso = toIsoDate(trial.trialEndsAt);
    await notify({
      organizationId,
      userIds: recipients,
      type: "TRIAL_ENDING",
      title: `${trial.app.name} trial ends ${leadDays === 0 ? "today" : `in ${leadDays} day${leadDays === 1 ? "" : "s"}`}`,
      body: trial.autoRenewal
        ? `Billing of ${Number(trial.amount)} ${trial.currency} starts automatically on ${endsIso}.`
        : `The trial ends on ${endsIso}; renew or cancel before then.`,
      link: `/subscriptions/${trial.id}`,
      dedupeKey: `trial:${trial.id}:${endsIso}:${leadDays}`,
      metadata: { subscriptionId: trial.id, leadDays, trialEndsAt: endsIso },
    });
    await prisma.reminderDispatch.updateMany({
      where: {
        subscriptionId: trial.id,
        kind: "TRIAL_ENDING",
        leadDays,
        targetDate: targetDay,
      },
      data: { recipientCount: recipients.length },
    });
    result.notified++;
  }
}

/** Trials past their end date with auto-renewal become paid subscriptions. */
async function convertExpiredTrials(
  organizationId: string,
  today: Date,
  result: TrialScanResult
): Promise<void> {
  const expired = await prisma.subscription.findMany({
    where: {
      organizationId,
      isTrial: true,
      autoRenewal: true,
      trialEndsAt: { lt: today },
    },
    select: { id: true, trialEndsAt: true },
  });
  for (const sub of expired) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { isTrial: false },
    });
    await prisma.auditLog.create({
      data: {
        organizationId,
        action: "TRIAL_CONVERTED",
        entityType: "subscription",
        entityId: sub.id,
        changes: { isTrial: { from: true, to: false } },
        metadata: { trialEndsAt: toIsoDate(sub.trialEndsAt) },
      },
    });
    result.converted++;
  }
}

export async function processTrialAlerts(
  now: Date = new Date()
): Promise<TrialScanResult> {
  const result: TrialScanResult = { ...emptyScanResult(), converted: 0 };
  const organizationIds = await listOrganizationIds();
  for (const organizationId of organizationIds) {
    result.processedOrganizations++;
    try {
      const settings = await getSettings(organizationId, [
        "subscriptions.trialAlertLeadDays",
        "general.timezone",
      ]);
      const today = todayInTimeZone(now, settings["general.timezone"]);
      for (const lead of new Set(
        settings["subscriptions.trialAlertLeadDays"]
      )) {
        await processLead(organizationId, today, lead, result);
      }
      await convertExpiredTrials(organizationId, today, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      logger.error({ err: error, organizationId }, "trial alerts failed");
      result.errors.push(`${organizationId}: ${message}`);
    }
  }
  return result;
}
