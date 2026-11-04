// src/actions/platform/notification-templates.ts
"use server";

import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import {
  COMMON_PLACEHOLDERS,
  DEFAULT_TEMPLATE_LOCALE,
  extractPlaceholders,
  getDefaultTemplate,
  NOTIFICATION_CHANNELS,
  TEMPLATE_PLACEHOLDERS,
} from "@/lib/services/notification/templates";
import {
  notificationTemplateInputSchema,
  notificationTemplateKeySchema,
} from "@/lib/validations/platform";
import type { ActionState } from "@/types";
import type { NotificationTemplateRow } from "@/types/platform";
import type { NotificationEventType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, toActionError, writeAudit } from "./_shared";

const TEMPLATES_PATH = "/settings/notification-templates";
const localeSchema = z
  .string()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
  .default(DEFAULT_TEMPLATE_LOCALE);

function placeholdersFor(eventType: NotificationEventType): string[] {
  return [...COMMON_PLACEHOLDERS, ...TEMPLATE_PLACEHOLDERS[eventType]];
}

async function _listNotificationTemplates(
  localeInput?: string
): Promise<ActionState<NotificationTemplateRow[]>> {
  try {
    const { organizationId } = await requirePermission(
      "notifications:manage_templates"
    );
    const locale = localeSchema.parse(localeInput ?? DEFAULT_TEMPLATE_LOCALE);
    const custom = await prisma.notificationTemplate.findMany({
      where: { organizationId, locale },
    });
    const byKey = new Map(
      custom.map((c) => [`${c.eventType}:${c.channel}`, c])
    );
    const rows: NotificationTemplateRow[] = [];
    for (const eventType of Object.keys(
      TEMPLATE_PLACEHOLDERS
    ) as NotificationEventType[]) {
      for (const channel of NOTIFICATION_CHANNELS) {
        const row = byKey.get(`${eventType}:${channel}`);
        const fallback = getDefaultTemplate(eventType, channel);
        rows.push({
          id: row?.id ?? null,
          eventType,
          channel,
          locale,
          subject: row ? (row.subject ?? "") : (fallback.subject ?? ""),
          body: row ? row.body : fallback.body,
          isActive: row ? row.isActive : true,
          source: row ? "custom" : "default",
          placeholders: placeholdersFor(eventType),
        });
      }
    }
    return { success: true, data: rows };
  } catch (error) {
    return toActionError(error, "listNotificationTemplates");
  }
}
export const listNotificationTemplates = withLogging(
  "listNotificationTemplates",
  _listNotificationTemplates
);

async function _upsertNotificationTemplate(
  raw: unknown
): Promise<ActionState<{ id: string }>> {
  try {
    const { organizationId, userId } = await requirePermission(
      "notifications:manage_templates"
    );
    const input = notificationTemplateInputSchema.parse(raw);
    const allowed = new Set(placeholdersFor(input.eventType));
    const unknown = extractPlaceholders({
      subject: input.subject ?? "",
      body: input.body,
    }).filter((p) => !allowed.has(p));
    if (unknown.length)
      throw new ActionError(
        `Unknown placeholders: ${unknown.map((p) => `{{${p}}}`).join(", ")}`
      );

    const where = {
      organizationId_eventType_channel_locale: {
        organizationId,
        eventType: input.eventType,
        channel: input.channel,
        locale: input.locale,
      },
    };
    const existing = await prisma.notificationTemplate.findUnique({ where });
    const saved = await prisma.notificationTemplate.upsert({
      where,
      create: {
        organizationId,
        eventType: input.eventType,
        channel: input.channel,
        locale: input.locale,
        subject: input.subject ?? null,
        body: input.body,
        isActive: input.isActive,
      },
      update: {
        subject: input.subject ?? null,
        body: input.body,
        isActive: input.isActive,
      },
    });
    await writeAudit({
      organizationId,
      userId,
      action: existing
        ? "UPDATE_NOTIFICATION_TEMPLATE"
        : "CREATE_NOTIFICATION_TEMPLATE",
      entityType: "NotificationTemplate",
      entityId: saved.id,
      changes: {
        from: existing
          ? {
              subject: existing.subject,
              body: existing.body,
              isActive: existing.isActive,
            }
          : null,
        to: {
          subject: input.subject ?? null,
          body: input.body,
          isActive: input.isActive,
        },
      },
    });
    revalidatePath(TEMPLATES_PATH);
    return { success: true, data: { id: saved.id } };
  } catch (error) {
    return toActionError(error, "upsertNotificationTemplate");
  }
}
export const upsertNotificationTemplate = withLogging(
  "upsertNotificationTemplate",
  _upsertNotificationTemplate
);

async function _setNotificationTemplateActive(
  raw: unknown,
  isActive: boolean
): Promise<ActionState> {
  try {
    const { organizationId, userId } = await requirePermission(
      "notifications:manage_templates"
    );
    const key = notificationTemplateKeySchema.parse(raw);
    const where = {
      organizationId_eventType_channel_locale: { organizationId, ...key },
    };
    const existing = await prisma.notificationTemplate.findUnique({ where });
    if (!existing)
      throw new ActionError(
        "Only customised templates can be toggled; the default is always active"
      );
    await prisma.notificationTemplate.update({ where, data: { isActive } });
    await writeAudit({
      organizationId,
      userId,
      action: isActive
        ? "ENABLE_NOTIFICATION_TEMPLATE"
        : "DISABLE_NOTIFICATION_TEMPLATE",
      entityType: "NotificationTemplate",
      entityId: existing.id,
    });
    revalidatePath(TEMPLATES_PATH);
    return { success: true };
  } catch (error) {
    return toActionError(error, "setNotificationTemplateActive");
  }
}
export const setNotificationTemplateActive = withLogging(
  "setNotificationTemplateActive",
  _setNotificationTemplateActive
);

async function _resetNotificationTemplate(raw: unknown): Promise<ActionState> {
  try {
    const { organizationId, userId } = await requirePermission(
      "notifications:manage_templates"
    );
    const key = notificationTemplateKeySchema.parse(raw);
    const deleted = await prisma.notificationTemplate.deleteMany({
      where: { organizationId, ...key },
    });
    if (deleted.count > 0) {
      await writeAudit({
        organizationId,
        userId,
        action: "RESET_NOTIFICATION_TEMPLATE",
        entityType: "NotificationTemplate",
        entityId: `${key.eventType}:${key.channel}:${key.locale}`,
      });
    }
    revalidatePath(TEMPLATES_PATH);
    return { success: true };
  } catch (error) {
    return toActionError(error, "resetNotificationTemplate");
  }
}
export const resetNotificationTemplate = withLogging(
  "resetNotificationTemplate",
  _resetNotificationTemplate
);
