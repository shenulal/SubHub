// src/lib/services/subscription/alert-support.ts
/**
 * Shared helpers for the subscription alert crons: organisation-local "today",
 * recipient resolution and the ReminderDispatch unique guard.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { ReminderKind } from "@prisma/client";

import { addUtcDays, MS_PER_DAY } from "./contract-terms";

/**
 * The calendar day in `timeZone` for instant `now`, expressed as a UTC-midnight
 * Date (matching how deadlines/trial ends are stored).
 */
export function todayInTimeZone(now: Date, timeZone: string): Date {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
  }
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}

/** `[start, end)` UTC-day range for a UTC-midnight date. */
export function utcDayRange(day: Date): { gte: Date; lt: Date } {
  return { gte: day, lt: new Date(day.getTime() + MS_PER_DAY) };
}

export function targetDayForLead(today: Date, leadDays: number): Date {
  return addUtcDays(today, leadDays);
}

export interface RecipientSubscription {
  ownerId: string | null;
  teamId: string | null;
}

/**
 * Owner + team approver + organisation admins (active users only, deduplicated).
 */
export async function resolveAlertRecipients(
  organizationId: string,
  subscription: RecipientSubscription,
  options: { includeAdmins?: boolean } = {}
): Promise<string[]> {
  const includeAdmins = options.includeAdmins ?? true;
  const [admins, team] = await Promise.all([
    includeAdmins
      ? prisma.user.findMany({
          where: { organizationId, role: "ADMIN", status: "ACTIVE" },
          select: { id: true },
        })
      : Promise.resolve([]),
    subscription.teamId
      ? prisma.team.findFirst({
          where: { id: subscription.teamId, organizationId },
          select: { approverId: true },
        })
      : Promise.resolve(null),
  ]);
  const ids = [
    subscription.ownerId,
    team?.approverId ?? null,
    ...admins.map((a) => a.id),
  ].filter((id): id is string => Boolean(id));
  return Array.from(new Set(ids));
}

export interface DispatchGuardInput {
  organizationId: string;
  subscriptionId: string;
  kind: ReminderKind;
  leadDays: number;
  targetDate: Date;
  recipientCount: number;
}

/**
 * Record a dispatch once per (subscription, kind, lead, target date).
 * Returns false when the reminder was already sent.
 */
export async function recordDispatchOnce(
  input: DispatchGuardInput
): Promise<boolean> {
  const existing = await prisma.reminderDispatch.findUnique({
    where: {
      subscriptionId_kind_leadDays_targetDate: {
        subscriptionId: input.subscriptionId,
        kind: input.kind,
        leadDays: input.leadDays,
        targetDate: input.targetDate,
      },
    },
    select: { id: true },
  });
  if (existing) return false;
  try {
    await prisma.reminderDispatch.create({ data: input });
    return true;
  } catch (error) {
    // Concurrent cron run inserted the same row first.
    logger.warn({ err: error, input }, "reminder dispatch already recorded");
    return false;
  }
}

export interface ScanResult {
  processedOrganizations: number;
  matched: number;
  notified: number;
  skipped: number;
  errors: string[];
}

export function emptyScanResult(): ScanResult {
  return {
    processedOrganizations: 0,
    matched: 0,
    notified: 0,
    skipped: 0,
    errors: [],
  };
}

export async function listOrganizationIds(): Promise<string[]> {
  const rows = await prisma.organization.findMany({ select: { id: true } });
  return rows.map((r) => r.id);
}
