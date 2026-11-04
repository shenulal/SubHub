// src/lib/services/notification/weeklyDigest.ts
/**
 * Weekly digest (11.2). The cron runs daily; this service sends only when the
 * organisation's `notifications.digestWeekday` / `digestTime` slot has been
 * reached in `general.timezone`, and at most once per calendar week
 * (dedupe key `digest:<org>:<week-start>`). Members opt out through the
 * DIGEST × EMAIL preference. Delivery goes through `notify()`.
 */
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings/service";
import { notify } from "./center";
import {
  buildDigestEmail,
  collectDigestStats,
  formatDateKey,
} from "./digest-content";
import { isScheduledSlotReached, toDateKey } from "./time";

const MS_PER_DAY = 86_400_000;
const DIGEST_LOOKBACK_DAYS = 7;

export interface WeeklyDigestJobResult {
  success: boolean;
  processedOrganizations: number;
  skippedOrganizations: number;
  emailsSent: number;
  inAppCreated: number;
  errors: string[];
}

export interface WeeklyDigestOptions {
  now?: Date;
  organizationIds?: string[];
}

/** Audience: active admins plus approvers; `notify()` applies per-user opt-outs. */
async function digestRecipients(organizationId: string): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      role: { in: ["ADMIN", "APPROVER"] },
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function processOrganization(
  org: { id: string; name: string },
  now: Date,
  result: WeeklyDigestJobResult
): Promise<void> {
  const settings = await getSettings(org.id, [
    "notifications.digestEnabled",
    "notifications.digestWeekday",
    "notifications.digestTime",
    "general.timezone",
    "discovery.renewingSoonDays",
    "finance.baseCurrency",
  ]);
  const timeZone = settings["general.timezone"];
  if (
    !settings["notifications.digestEnabled"] ||
    !isScheduledSlotReached(
      now,
      timeZone,
      settings["notifications.digestWeekday"],
      settings["notifications.digestTime"]
    )
  ) {
    result.skippedOrganizations++;
    return;
  }

  const recipients = await digestRecipients(org.id);
  if (recipients.length === 0) {
    result.errors.push(`${org.id}: no digest recipients`);
    return;
  }

  const start = new Date(now.getTime() - DIGEST_LOOKBACK_DAYS * MS_PER_DAY);
  const stats = await collectDigestStats(org.id, {
    start,
    end: now,
    renewingSoonDays: settings["discovery.renewingSoonDays"],
    baseCurrency: settings["finance.baseCurrency"],
  });
  const weekRange = `${formatDateKey(start)} ~ ${formatDateKey(now)}`;
  const email = buildDigestEmail(
    org.name,
    weekRange,
    stats,
    settings["discovery.renewingSoonDays"]
  );

  const res = await notify({
    organizationId: org.id,
    userIds: recipients,
    type: "DIGEST",
    title: email.title,
    body: email.body,
    link: "/dashboard",
    email: { subject: email.subject, html: email.html, text: email.text },
    templateVars: {
      periodLabel: "weekly",
      renewalCount: stats.upcomingRenewals,
      approvalCount: stats.pendingApprovals,
      totalMonthly: stats.committedMonthlySpend.toFixed(2),
      currency: stats.committedCurrency,
    },
    dedupeKey: `digest:${org.id}:${toDateKey(now, timeZone)}`,
    metadata: { stats: JSON.parse(JSON.stringify(stats)) },
    bypassQuietHours: true,
    now,
  });
  result.processedOrganizations++;
  result.emailsSent += res.emailsSent;
  result.inAppCreated += res.inAppCreated;
}

export async function processWeeklyDigest(
  options: WeeklyDigestOptions = {}
): Promise<WeeklyDigestJobResult> {
  const now = options.now ?? new Date();
  const result: WeeklyDigestJobResult = {
    success: true,
    processedOrganizations: 0,
    skippedOrganizations: 0,
    emailsSent: 0,
    inAppCreated: 0,
    errors: [],
  };
  try {
    const organizations = await prisma.organization.findMany({
      where: options.organizationIds
        ? { id: { in: options.organizationIds } }
        : {},
      select: { id: true, name: true },
    });
    for (const org of organizations) {
      try {
        await processOrganization(org, now, result);
      } catch (error) {
        result.errors.push(
          `${org.id}: ${error instanceof Error ? error.message : "digest failed"}`
        );
      }
    }
  } catch (error) {
    result.success = false;
    result.errors.push(
      error instanceof Error ? error.message : "digest failed"
    );
  }
  return result;
}
