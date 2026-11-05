// src/lib/services/notification/adapters/templates.ts
/**
 * Adapter over the Platform agent's template contract
 * (`getTemplate(organizationId, eventType, channel, locale)` → ResolvedTemplate,
 *  `renderTemplate(template, vars)` → { subject, body }).
 *
 * `getTemplate` always resolves (organisation override, else built-in default);
 * `source` tells callers whether the copy was customised by the organisation.
 */
import { logger } from "@/lib/logger";
import {
  getTemplate,
  renderTemplate,
} from "@/lib/services/notification/templates";
import type {
  NotificationChannel,
  NotificationEventType,
} from "@prisma/client";

export type TemplateVars = Record<string, unknown>;

export interface LoadedTemplate {
  subject: string | null;
  body: string;
  /** "custom" = organisation override, "default" = built-in copy. */
  source: "custom" | "default";
}

export type ChannelTemplateSet = Partial<
  Record<NotificationChannel, LoadedTemplate>
>;

export interface RenderedCopy {
  subject: string;
  body: string;
}

const CHANNELS: NotificationChannel[] = ["IN_APP", "EMAIL", "PUSH"];

/** Load the three channel templates for an event (null entries on failure). */
export async function loadTemplates(
  organizationId: string,
  eventType: NotificationEventType,
  locale: string
): Promise<ChannelTemplateSet> {
  const entries = await Promise.all(
    CHANNELS.map(async (channel) => {
      try {
        const t = await getTemplate(organizationId, eventType, channel, locale);
        if (!t || !t.body) return [channel, undefined] as const;
        return [
          channel,
          {
            subject: t.subject ?? null,
            body: t.body,
            source: t.source === "custom" ? "custom" : "default",
          } satisfies LoadedTemplate,
        ] as const;
      } catch (error) {
        logger.warn(
          { err: error, eventType, channel },
          "[notify] template load failed; using literal copy"
        );
        return [channel, undefined] as const;
      }
    })
  );
  return Object.fromEntries(entries) as ChannelTemplateSet;
}

/** Pure render of a loaded template with the given variables. */
export function renderLoadedTemplate(
  template: LoadedTemplate,
  vars: TemplateVars
): RenderedCopy {
  const out = renderTemplate(
    { subject: template.subject ?? undefined, body: template.body },
    vars
  );
  return { subject: out.subject ?? "", body: out.body ?? "" };
}

/** Minimal HTML wrapper for plain-text template bodies used as emails. */
export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#0f766e;">$1</a>'
  );
  const paragraphs = linked
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<!DOCTYPE html><html><body style="font-family:Lato,Inter,Segoe UI,Arial,sans-serif;color:#1f2937;max-width:600px;margin:0 auto;padding:24px;line-height:1.6;">${paragraphs}</body></html>`;
}
