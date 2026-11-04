// src/lib/services/notification/center.ts
/**
 * Unified notification dispatch.
 *
 * `notify()` is the single entry point every feature uses to reach a member:
 *  - writes a persistent in-app `Notification` row per recipient (deduped by `dedupeKey`)
 *  - resolves copy from organisation templates when `templateVars` is passed
 *    (rendered per recipient so `{{recipientName}}` works); literal
 *    `title`/`body`/`email` remain supported and are used when no template applies.
 *    Rich literal emails are kept unless the organisation customised the EMAIL template.
 *  - honours per-user `NotificationPreference` rows and `notifications.enabledChannels`
 *  - holds email/push during quiet hours (`metadata.deferredUntil`), released by
 *    `processDeferredNotifications()` from the subscription-reminders cron
 *  - sends push through the configured `PushProvider` when device tokens exist
 *  - trims each recipient's inbox per `notifications.maxInAppItems` and
 *    `privacy.notificationRetentionDays`
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSettings } from "@/lib/settings/service";
import type {
  NotificationChannel,
  NotificationEventType,
  Prisma,
} from "@prisma/client";
import {
  loadTemplates,
  renderLoadedTemplate,
  textToHtml,
  type ChannelTemplateSet,
  type TemplateVars,
} from "./adapters/templates";
import {
  sendNotifyEmails,
  type NotifyEmailContent,
  type NotifyEmailRecipient,
} from "./center-email";
import { sendNotifyPush, type NotifyPushContent } from "./center-push";
import { getBaseUrl } from "./email.utils";
import { trimInboxes } from "./retention";
import { quietHoursEndsAt } from "./time";

export type { NotifyEmailContent } from "./center-email";

export interface NotifyInput {
  organizationId: string;
  /** Recipients (user ids inside the organisation) */
  userIds: string[];
  type: NotificationEventType;
  /** Literal copy (used when no template applies). */
  title?: string;
  body?: string;
  link?: string;
  /** Stable key per (user, event) to avoid duplicates, e.g. `renewal:<subId>:<date>:7` */
  dedupeKey?: string;
  metadata?: Prisma.InputJsonValue;
  /** Literal email; kept unless the organisation customised the EMAIL template. */
  email?: NotifyEmailContent;
  /** Variables for organisation templates (`{{placeholders}}`). */
  templateVars?: TemplateVars;
  locale?: string;
  /** Restrict delivery to these channels (default: all enabled). */
  channels?: NotificationChannel[];
  /** Deliver immediately even inside quiet hours (e.g. security alerts). */
  bypassQuietHours?: boolean;
  /** Clock override for tests. */
  now?: Date;
}

export interface NotifyResult {
  inAppCreated: number;
  emailsSent: number;
  pushSent: number;
  deferred: number;
  skipped: number;
  /** Recipients excluded because the dedupe key was already delivered. */
  deduped: number;
}

const EMPTY_RESULT: NotifyResult = {
  inAppCreated: 0,
  emailsSent: 0,
  pushSent: 0,
  deferred: 0,
  skipped: 0,
  deduped: 0,
};

const DEFAULT_LOCALE = "en";
const PRODUCT_NAME = "SubHub";

type PreferenceLookup = (
  userId: string,
  channel: NotificationChannel
) => boolean;

interface RecipientUser {
  id: string;
  name: string | null;
  email: string;
}

interface RecipientContent {
  title: string;
  body: string | null;
  email: NotifyEmailContent | null;
  push: NotifyPushContent;
}

async function loadPreferences(
  userIds: string[],
  type: NotificationEventType
): Promise<PreferenceLookup> {
  const rows = await prisma.notificationPreference.findMany({
    where: { userId: { in: userIds }, eventType: type },
    select: { userId: true, channel: true, enabled: true },
  });
  const map = new Map<string, Map<NotificationChannel, boolean>>();
  for (const r of rows) {
    const inner = map.get(r.userId) ?? new Map<NotificationChannel, boolean>();
    inner.set(r.channel, r.enabled);
    map.set(r.userId, inner);
  }
  return (userId, channel) => map.get(userId)?.get(channel) ?? true;
}

async function excludeAlreadyDelivered(
  userIds: string[],
  dedupeKey: string | undefined
): Promise<{ fresh: string[]; deduped: number }> {
  if (!dedupeKey) return { fresh: userIds, deduped: 0 };
  const existing = await prisma.notification.findMany({
    where: { userId: { in: userIds }, dedupeKey },
    select: { userId: true },
  });
  const seen = new Set(existing.map((e) => e.userId));
  const fresh = userIds.filter((id) => !seen.has(id));
  return { fresh, deduped: userIds.length - fresh.length };
}

async function loadRecipients(userIds: string[]): Promise<RecipientUser[]> {
  return prisma.user.findMany({
    where: { id: { in: userIds }, status: "ACTIVE" },
    select: { id: true, name: true, email: true },
  });
}

/** Build the per-recipient copy: templates (when `templateVars`) over literals. */
function buildContent(
  input: NotifyInput,
  templates: ChannelTemplateSet | null,
  organizationName: string,
  user: RecipientUser
): RecipientContent {
  let title = input.title ?? null;
  let body = input.body ?? null;
  let email = input.email ?? null;
  let push: NotifyPushContent | null = null;

  if (templates && input.templateVars) {
    const link = input.link
      ? input.link.startsWith("http")
        ? input.link
        : `${getBaseUrl()}${input.link}`
      : "";
    const vars: TemplateVars = {
      recipientName: user.name ?? user.email,
      organizationName,
      productName: PRODUCT_NAME,
      link,
      ...input.templateVars,
    };
    if (templates.IN_APP) {
      const r = renderLoadedTemplate(templates.IN_APP, vars);
      title = r.subject || title;
      body = r.body || body;
    }
    if (templates.EMAIL && (templates.EMAIL.source === "custom" || !email)) {
      const r = renderLoadedTemplate(templates.EMAIL, vars);
      email = {
        subject: r.subject || title || input.type,
        html: textToHtml(r.body),
        text: r.body,
      };
    }
    if (templates.PUSH) {
      const r = renderLoadedTemplate(templates.PUSH, vars);
      push = {
        title: r.subject || title || input.type,
        body: r.body,
        link: input.link,
      };
    }
  }

  if (!title) {
    throw new Error(
      "notify(): `title` or a matching IN_APP template is required"
    );
  }
  return {
    title,
    body,
    email,
    push: push ?? { title, body: body ?? undefined, link: input.link },
  };
}

function toMetadata(
  base: Prisma.InputJsonValue | undefined,
  deferredUntil: Date | null,
  email: NotifyEmailContent | null,
  push: NotifyPushContent | null
): Prisma.InputJsonValue | undefined {
  if (!deferredUntil) return base;
  const baseObject =
    base && typeof base === "object" && !Array.isArray(base)
      ? (base as Record<string, unknown>)
      : {};
  return {
    ...baseObject,
    deferredUntil: deferredUntil.getTime(),
    ...(email ? { deferredEmail: email } : {}),
    ...(push ? { deferredPush: push } : {}),
  } as unknown as Prisma.InputJsonValue;
}

export async function notify(input: NotifyInput): Promise<NotifyResult> {
  const uniqueUserIds = Array.from(new Set(input.userIds)).filter(Boolean);
  if (uniqueUserIds.length === 0) return { ...EMPTY_RESULT };

  const now = input.now ?? new Date();
  const [settings, allows, dedupe] = await Promise.all([
    getSettings(input.organizationId, [
      "notifications.enabledChannels",
      "notifications.quietHoursStart",
      "notifications.quietHoursEnd",
      "notifications.maxInAppItems",
      "privacy.notificationRetentionDays",
      "general.timezone",
    ]),
    loadPreferences(uniqueUserIds, input.type),
    excludeAlreadyDelivered(uniqueUserIds, input.dedupeKey),
  ]);
  if (dedupe.fresh.length === 0)
    return { ...EMPTY_RESULT, deduped: dedupe.deduped };

  const requested = new Set<NotificationChannel>(
    input.channels ?? ["IN_APP", "EMAIL", "PUSH"]
  );
  const channelOn = (c: NotificationChannel) =>
    requested.has(c) && settings["notifications.enabledChannels"].includes(c);
  const recipients = (c: NotificationChannel) =>
    channelOn(c) ? dedupe.fresh.filter((id) => allows(id, c)) : [];

  const inAppRecipients = recipients("IN_APP");
  const emailRecipients = recipients("EMAIL");
  const pushRecipients = recipients("PUSH");
  if (
    !inAppRecipients.length &&
    !emailRecipients.length &&
    !pushRecipients.length
  ) {
    return {
      ...EMPTY_RESULT,
      skipped: dedupe.fresh.length,
      deduped: dedupe.deduped,
    };
  }

  const [users, templates, organization] = await Promise.all([
    loadRecipients(dedupe.fresh),
    input.templateVars
      ? loadTemplates(
          input.organizationId,
          input.type,
          input.locale ?? DEFAULT_LOCALE
        )
      : Promise.resolve(null),
    prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { name: true },
    }),
  ]);
  const contentByUser = new Map(
    users.map((u) => [
      u.id,
      buildContent(input, templates, organization?.name ?? "", u),
    ])
  );
  const hasEmail = (id: string) => Boolean(contentByUser.get(id)?.email);
  const emailTargets = emailRecipients.filter(hasEmail);

  const deferredUntil = input.bypassQuietHours
    ? null
    : quietHoursEndsAt(now, {
        start: settings["notifications.quietHoursStart"],
        end: settings["notifications.quietHoursEnd"],
        timeZone: settings["general.timezone"],
      });

  // Deferral rides on the in-app row; users without an in-app row are sent now.
  const inAppSet = new Set(inAppRecipients);
  const deferEmail = new Set(
    deferredUntil ? emailTargets.filter((id) => inAppSet.has(id)) : []
  );
  const deferPush = new Set(
    deferredUntil ? pushRecipients.filter((id) => inAppSet.has(id)) : []
  );

  const created = inAppRecipients.length
    ? await prisma.notification.createMany({
        data: inAppRecipients
          .filter((userId) => contentByUser.has(userId))
          .map((userId) => {
            const c = contentByUser.get(userId)!;
            return {
              organizationId: input.organizationId,
              userId,
              type: input.type,
              title: c.title,
              body: c.body,
              link: input.link ?? null,
              dedupeKey: input.dedupeKey ?? null,
              metadata: toMetadata(
                input.metadata,
                deferredUntil,
                deferEmail.has(userId) ? c.email : null,
                deferPush.has(userId) ? c.push : null
              ),
            };
          }),
        skipDuplicates: true,
      })
    : { count: 0 };

  const emailNow: NotifyEmailRecipient[] = emailTargets
    .filter((id) => !deferEmail.has(id))
    .map((id) => {
      const user = users.find((u) => u.id === id)!;
      return { email: user.email, content: contentByUser.get(id)!.email! };
    });
  const pushNow = pushRecipients.filter(
    (id) => !deferPush.has(id) && contentByUser.has(id)
  );

  const [emailsSent, pushSent] = await Promise.all([
    emailNow.length
      ? sendNotifyEmails(input.organizationId, emailNow, input.type)
      : Promise.resolve(0),
    pushNow.length
      ? sendNotifyPush(pushNow, contentByUser.get(pushNow[0])!.push, input.type)
      : Promise.resolve(0),
  ]);

  if (created.count > 0) {
    try {
      await trimInboxes(input.organizationId, inAppRecipients, {
        maxItems: settings["notifications.maxInAppItems"],
        retentionDays: settings["privacy.notificationRetentionDays"],
        now,
      });
    } catch (error) {
      logger.warn({ err: error }, "[notify] inbox trim failed");
    }
  }

  const skipped =
    dedupe.fresh.length * 3 -
    inAppRecipients.length -
    emailRecipients.length -
    pushRecipients.length;

  return {
    inAppCreated: created.count,
    emailsSent,
    pushSent,
    deferred: deferEmail.size + deferPush.size,
    skipped,
    deduped: dedupe.deduped,
  };
}

/** Admin user ids for an organisation (common escalation audience). */
export async function getOrganizationAdminIds(
  organizationId: string
): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { organizationId, status: "ACTIVE", role: { in: ["ADMIN"] } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
