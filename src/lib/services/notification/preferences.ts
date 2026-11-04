// src/lib/services/notification/preferences.ts
/**
 * Per-user notification preferences (event type × channel) and the personal
 * default reminder lead days stored on `User.preferences.reminderLeadDays`.
 */
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings/service";
import type {
  NotificationPreferenceCell,
  NotificationPreferenceMatrix,
} from "@/types/notification";
import { ALL_NOTIFICATION_EVENT_TYPES } from "@/types/notification";
import type { NotificationChannel, Prisma } from "@prisma/client";

export const USER_PREF_REMINDER_LEAD_DAYS = "reminderLeadDays";

export class PreferenceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreferenceValidationError";
  }
}

export function readUserReminderLeadDays(
  preferences: Prisma.JsonValue | null | undefined
): number[] | null {
  if (
    !preferences ||
    typeof preferences !== "object" ||
    Array.isArray(preferences)
  )
    return null;
  const raw = (preferences as Record<string, unknown>)[
    USER_PREF_REMINDER_LEAD_DAYS
  ];
  if (!Array.isArray(raw)) return null;
  const days = raw.filter((d): d is number => Number.isInteger(d) && d >= 0);
  return days.length > 0 ? days : null;
}

export async function getPreferenceMatrix(
  organizationId: string,
  userId: string
): Promise<NotificationPreferenceMatrix> {
  const [settings, rows, user] = await Promise.all([
    getSettings(organizationId, [
      "notifications.enabledChannels",
      "subscriptions.reminderLeadDayOptions",
      "subscriptions.defaultReminderLeadDays",
    ]),
    prisma.notificationPreference.findMany({
      where: { userId },
      select: { eventType: true, channel: true, enabled: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    }),
  ]);
  const channels = settings[
    "notifications.enabledChannels"
  ] as NotificationChannel[];
  const stored = new Map(
    rows.map((r) => [`${r.eventType}:${r.channel}`, r.enabled] as const)
  );
  const cells: NotificationPreferenceCell[] =
    ALL_NOTIFICATION_EVENT_TYPES.flatMap((eventType) =>
      channels.map((channel) => ({
        eventType,
        channel,
        enabled: stored.get(`${eventType}:${channel}`) ?? true,
      }))
    );
  const organizationDefaultLeadDays =
    settings["subscriptions.defaultReminderLeadDays"];
  return {
    channels,
    cells,
    reminderLeadDays:
      readUserReminderLeadDays(user?.preferences) ??
      organizationDefaultLeadDays,
    reminderLeadDayOptions: settings["subscriptions.reminderLeadDayOptions"],
    organizationDefaultLeadDays,
  };
}

export async function savePreferenceCells(
  userId: string,
  cells: NotificationPreferenceCell[]
): Promise<number> {
  if (cells.length === 0) return 0;
  await prisma.$transaction(
    cells.map((cell) =>
      prisma.notificationPreference.upsert({
        where: {
          userId_eventType_channel: {
            userId,
            eventType: cell.eventType,
            channel: cell.channel,
          },
        },
        create: { userId, ...cell },
        update: { enabled: cell.enabled },
      })
    )
  );
  return cells.length;
}

/** Validates against `subscriptions.reminderLeadDayOptions` and stores on the user. */
export async function saveUserReminderLeadDays(
  organizationId: string,
  userId: string,
  leadDays: number[]
): Promise<number[]> {
  const settings = await getSettings(organizationId, [
    "subscriptions.reminderLeadDayOptions",
  ]);
  const allowed = new Set(settings["subscriptions.reminderLeadDayOptions"]);
  const unique = Array.from(new Set(leadDays)).sort((a, b) => b - a);
  const invalid = unique.filter((d) => !allowed.has(d));
  if (invalid.length > 0) {
    throw new PreferenceValidationError(
      `Lead days not offered by the organisation: ${invalid.join(", ")}`
    );
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  const current =
    user?.preferences &&
    typeof user.preferences === "object" &&
    !Array.isArray(user.preferences)
      ? (user.preferences as Record<string, unknown>)
      : {};
  await prisma.user.update({
    where: { id: userId },
    data: {
      preferences: {
        ...current,
        [USER_PREF_REMINDER_LEAD_DAYS]: unique,
      } as Prisma.InputJsonValue,
    },
  });
  return unique;
}
