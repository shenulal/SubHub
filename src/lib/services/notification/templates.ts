// src/lib/services/notification/templates.ts
/**
 * Notification templates: resolve the organisation's override (or the English
 * default) and render `{{placeholders}}`.
 *
 *   const tpl = await getTemplate(orgId, "RENEWAL_REMINDER", "EMAIL");
 *   const { subject, body } = renderTemplate(tpl, { serviceName: "Figma", ... });
 */
import { prisma } from "@/lib/db";
import type {
  NotificationChannel,
  NotificationEventType,
} from "@prisma/client";
import {
  DEFAULT_TEMPLATE_LOCALE,
  getDefaultTemplate,
  type TemplateContent,
} from "./default-templates";

export {
  COMMON_PLACEHOLDERS,
  DEFAULT_TEMPLATE_LOCALE,
  DEFAULT_TEMPLATES,
  getDefaultTemplate,
  NOTIFICATION_CHANNELS,
  TEMPLATE_PLACEHOLDERS,
} from "./default-templates";
export type { TemplateContent } from "./default-templates";
export {
  extractPlaceholders,
  renderString,
  renderTemplate,
  type RenderedTemplate,
  type TemplateVars,
} from "./template-render";

export interface ResolvedTemplate extends TemplateContent {
  eventType: NotificationEventType;
  channel: NotificationChannel;
  locale: string;
  /** "custom" when an active organisation override was used */
  source: "custom" | "default";
}

/**
 * Organisation override (requested locale, then default locale) → built-in default.
 * Inactive overrides are ignored so "disable" falls back to the default copy.
 */
export async function getTemplate(
  organizationId: string,
  eventType: NotificationEventType,
  channel: NotificationChannel,
  locale: string = DEFAULT_TEMPLATE_LOCALE
): Promise<ResolvedTemplate> {
  const locales = Array.from(new Set([locale, DEFAULT_TEMPLATE_LOCALE]));
  const rows = await prisma.notificationTemplate.findMany({
    where: {
      organizationId,
      eventType,
      channel,
      locale: { in: locales },
      isActive: true,
    },
    select: { locale: true, subject: true, body: true },
  });
  for (const candidate of locales) {
    const row = rows.find((r) => r.locale === candidate);
    if (row) {
      return {
        eventType,
        channel,
        locale: candidate,
        subject: row.subject ?? undefined,
        body: row.body,
        source: "custom",
      };
    }
  }
  const fallback = getDefaultTemplate(eventType, channel);
  return {
    eventType,
    channel,
    locale: DEFAULT_TEMPLATE_LOCALE,
    ...fallback,
    source: "default",
  };
}
