// src/lib/services/notification/reminders.ts
/**
 * Renewal reminders (3.1 / 3.4).
 *
 * For every ACTIVE subscription with a renewal date, for each lead day in
 * `subscription.reminderLeadDays` (fallback `subscriptions.defaultReminderLeadDays`),
 * when `renewalDate − lead == today` in `general.timezone`:
 *   recipients = owner + assigned users + team approver
 *   (+ approvers of the originating approval request when
 *    `notifications.copyApproversOnRenewal` is on → type APPROVER_RENEWAL).
 * Each (subscription, RENEWAL, leadDays, targetDate) is recorded once in
 * `ReminderDispatch`.
 *
 * The legacy 30/60/90 cron delegates here with `legacyFlagsOnly: true`, which
 * limits lead days to those whose `renewalAlert30/60/90` flag is set.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSettings } from "@/lib/settings/service";
import { getApproverIdsForSubscription } from "./adapters/approvers";
import { notify } from "./center";
import { buildRenewalReminderCopy } from "./reminders-email";
import { dateKeyToUtcDate, shiftDateKey, toDateKey } from "./time";

const MS_PER_DAY = 86_400_000;
const LEGACY_LEAD_DAYS = [30, 60, 90] as const;
const QUERY_PADDING_DAYS = 2;

export interface ReminderRunOptions {
  now?: Date;
  /** Only process these organisations (default: all). */
  organizationIds?: string[];
  /** Legacy mode: lead days 30/60/90 gated by `renewalAlert30/60/90` flags. */
  legacyFlagsOnly?: boolean;
}

export interface ReminderRunResult {
  processedAt: Date;
  organizations: number;
  subscriptionsChecked: number;
  remindersSent: number;
  recipientsNotified: number;
  skippedDuplicates: number;
  errors: string[];
}

type SubscriptionRow = Awaited<ReturnType<typeof loadCandidates>>[number];

async function loadCandidates(
  organizationId: string,
  now: Date,
  maxLeadDays: number
) {
  const from = new Date(now.getTime() - QUERY_PADDING_DAYS * MS_PER_DAY);
  const to = new Date(
    now.getTime() + (maxLeadDays + QUERY_PADDING_DAYS) * MS_PER_DAY
  );
  return prisma.subscription.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      renewalDate: { gte: from, lte: to },
    },
    select: {
      id: true,
      amount: true,
      currency: true,
      billingCycle: true,
      renewalDate: true,
      reminderLeadDays: true,
      renewalAlert30: true,
      renewalAlert60: true,
      renewalAlert90: true,
      ownerId: true,
      isPersonal: true,
      owner: { select: { name: true, email: true } },
      app: { select: { name: true } },
      assignedUsers: { select: { userId: true } },
      team: { select: { approverId: true } },
      approvalRequest: { select: { id: true } },
    },
  });
}

function legacyFlagLeadDays(sub: SubscriptionRow): number[] {
  const flags: Record<(typeof LEGACY_LEAD_DAYS)[number], boolean> = {
    30: sub.renewalAlert30,
    60: sub.renewalAlert60,
    90: sub.renewalAlert90,
  };
  return LEGACY_LEAD_DAYS.filter((d) => flags[d]);
}

export function resolveLeadDays(
  sub: Pick<
    SubscriptionRow,
    "reminderLeadDays" | "renewalAlert30" | "renewalAlert60" | "renewalAlert90"
  >,
  organizationDefault: number[],
  legacyFlagsOnly: boolean
): number[] {
  if (legacyFlagsOnly) return legacyFlagLeadDays(sub as SubscriptionRow);
  const own = sub.reminderLeadDays ?? [];
  return Array.from(new Set(own.length > 0 ? own : organizationDefault));
}

/** Lead days due today: `renewalDate − lead == today` (calendar days, org zone). */
export function dueLeadDays(
  renewalDate: Date,
  leadDays: number[],
  todayKey: string,
  timeZone: string
): number[] {
  const renewalKey = toDateKey(renewalDate, timeZone);
  return leadDays.filter(
    (lead) => shiftDateKey(renewalKey, -lead) === todayKey
  );
}

function baseRecipients(sub: SubscriptionRow): string[] {
  const ids = [
    sub.ownerId,
    ...sub.assignedUsers.map((a) => a.userId),
    sub.team?.approverId ?? null,
  ];
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

interface OrgContext {
  id: string;
  name: string;
  timeZone: string;
  defaultLeadDays: number[];
  copyApprovers: boolean;
}

async function dispatchReminder(
  org: OrgContext,
  sub: SubscriptionRow,
  leadDays: number,
  now: Date
): Promise<{ sent: boolean; recipients: number }> {
  const renewalKey = toDateKey(sub.renewalDate!, org.timeZone);
  const targetDate = dateKeyToUtcDate(renewalKey);

  // Unique guard: one dispatch per (subscription, kind, leadDays, targetDate).
  const existing = await prisma.reminderDispatch.findUnique({
    where: {
      subscriptionId_kind_leadDays_targetDate: {
        subscriptionId: sub.id,
        kind: "RENEWAL",
        leadDays,
        targetDate,
      },
    },
    select: { id: true },
  });
  if (existing) return { sent: false, recipients: 0 };

  const primary = baseRecipients(sub);
  const approvers =
    org.copyApprovers && sub.approvalRequest
      ? (await getApproverIdsForSubscription(sub.id)).filter(
          (id) => !primary.includes(id)
        )
      : [];

  const common = {
    appName: sub.app.name,
    billingCycle: sub.billingCycle,
    ownerName: sub.owner?.name ?? sub.owner?.email ?? null,
    subscriptionId: sub.id,
    renewalDateKey: renewalKey,
    leadDays,
    amount: Number(sub.amount),
    currency: sub.currency,
    organizationName: org.name,
  };
  const dedupeBase = `renewal:${sub.id}:${renewalKey}:${leadDays}`;

  const sends = [
    { userIds: primary, type: "RENEWAL_REMINDER" as const, forApprover: false },
    {
      userIds: approvers,
      type: "APPROVER_RENEWAL" as const,
      forApprover: true,
    },
  ].filter((s) => s.userIds.length > 0);

  let recipients = 0;
  for (const send of sends) {
    const copy = buildRenewalReminderCopy({
      ...common,
      forApprover: send.forApprover,
    });
    const res = await notify({
      organizationId: org.id,
      userIds: send.userIds,
      type: send.type,
      title: copy.title,
      body: copy.body,
      link: copy.link,
      email: copy.email,
      templateVars: copy.templateVars,
      dedupeKey: `${dedupeBase}:${send.type}`,
      metadata: { subscriptionId: sub.id, leadDays, renewalDate: renewalKey },
      now,
    });
    recipients += res.inAppCreated + res.emailsSent;
  }

  await prisma.reminderDispatch.create({
    data: {
      organizationId: org.id,
      subscriptionId: sub.id,
      kind: "RENEWAL",
      leadDays,
      targetDate,
      recipientCount: primary.length + approvers.length,
      sentAt: now,
    },
  });
  return { sent: true, recipients };
}

async function processOrganization(
  orgRow: { id: string; name: string },
  options: ReminderRunOptions,
  now: Date,
  result: ReminderRunResult
): Promise<void> {
  const settings = await getSettings(orgRow.id, [
    "general.timezone",
    "subscriptions.defaultReminderLeadDays",
    "notifications.copyApproversOnRenewal",
  ]);
  const org: OrgContext = {
    id: orgRow.id,
    name: orgRow.name,
    timeZone: settings["general.timezone"],
    defaultLeadDays: settings["subscriptions.defaultReminderLeadDays"],
    copyApprovers: settings["notifications.copyApproversOnRenewal"],
  };
  const legacy = options.legacyFlagsOnly ?? false;
  const maxLead = legacy
    ? Math.max(...LEGACY_LEAD_DAYS)
    : Math.max(0, ...org.defaultLeadDays, 90);
  const todayKey = toDateKey(now, org.timeZone);
  const candidates = await loadCandidates(org.id, now, maxLead);
  result.subscriptionsChecked += candidates.length;

  for (const sub of candidates) {
    if (!sub.renewalDate) continue;
    const leads = resolveLeadDays(sub, org.defaultLeadDays, legacy);
    for (const lead of dueLeadDays(
      sub.renewalDate,
      leads,
      todayKey,
      org.timeZone
    )) {
      try {
        const out = await dispatchReminder(org, sub, lead, now);
        if (out.sent) {
          result.remindersSent++;
          result.recipientsNotified += out.recipients;
        } else {
          result.skippedDuplicates++;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "unknown error";
        result.errors.push(`${sub.id}/${lead}: ${message}`);
        logger.error(
          { err: error, subscriptionId: sub.id, lead },
          "[reminders] dispatch failed"
        );
      }
    }
  }
}

export async function processSubscriptionReminders(
  options: ReminderRunOptions = {}
): Promise<ReminderRunResult> {
  const now = options.now ?? new Date();
  const result: ReminderRunResult = {
    processedAt: now,
    organizations: 0,
    subscriptionsChecked: 0,
    remindersSent: 0,
    recipientsNotified: 0,
    skippedDuplicates: 0,
    errors: [],
  };
  const organizations = await prisma.organization.findMany({
    where: options.organizationIds
      ? { id: { in: options.organizationIds } }
      : {},
    select: { id: true, name: true },
  });
  for (const org of organizations) {
    result.organizations++;
    try {
      await processOrganization(org, options, now, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      result.errors.push(`${org.id}: ${message}`);
    }
  }
  return result;
}
