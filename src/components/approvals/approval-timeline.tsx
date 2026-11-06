// src/components/approvals/approval-timeline.tsx
"use client";

import { cn } from "@/lib/utils";
import type { ApprovalEventView } from "@/types/approval";
import {
  Bell,
  Check,
  CircleSlash,
  HelpCircle,
  MessageSquare,
  PackageCheck,
  Reply,
  Send,
  TrendingUp,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { formatDateOnly, formatDateTime, userLabel } from "./format";

const ICONS = {
  SUBMITTED: Send,
  APPROVED: Check,
  REJECTED: X,
  INFO_REQUESTED: HelpCircle,
  INFO_PROVIDED: Reply,
  COMMENTED: MessageSquare,
  REMINDED: Bell,
  ESCALATED: TrendingUp,
  CANCELLED: CircleSlash,
  SUBSCRIPTION_CREATED: PackageCheck,
} as const;

const TONE = {
  SUBMITTED: "tonal-primary",
  APPROVED: "tonal-success",
  REJECTED: "tonal-error",
  INFO_REQUESTED: "tonal-info",
  INFO_PROVIDED: "tonal-info",
  COMMENTED: "tonal-neutral",
  REMINDED: "tonal-warning",
  ESCALATED: "tonal-warning",
  CANCELLED: "tonal-neutral",
  SUBSCRIPTION_CREATED: "tonal-success",
} as const;

function eventKey(event: ApprovalEventView): string {
  if (event.type === "APPROVED" && event.metadata?.autoApproved)
    return "APPROVED_AUTO";
  if (event.type === "CANCELLED" && event.metadata?.expired)
    return "CANCELLED_EXPIRED";
  return event.type;
}

const SYSTEM_EVENTS = new Set([
  "APPROVED_AUTO",
  "CANCELLED_EXPIRED",
  "REMINDED",
  "ESCALATED",
  "SUBSCRIPTION_CREATED",
]);

function text(
  meta: Record<string, unknown> | null,
  key: string
): string | null {
  const value = meta?.[key];
  return typeof value === "string" && value ? value : null;
}

function labelOf(meta: Record<string, unknown> | null, key: string) {
  const value = meta?.[key];
  if (value && typeof value === "object" && "label" in value) {
    const label = (value as { label?: unknown }).label;
    return typeof label === "string" ? label : null;
  }
  if (value && typeof value === "object" && "name" in value) {
    const name = (value as { name?: unknown }).name;
    return typeof name === "string" ? name : null;
  }
  return null;
}

/** Captured decision details (reason, conditions, assignments, start date). */
function EventDetails({ event }: { event: ApprovalEventView }) {
  const t = useTranslations("approvals.events.details");
  const meta = event.metadata;
  const reason = labelOf(meta, "reason");
  const conditions = text(meta, "conditions");
  const start = text(meta, "effectiveStartDate");
  const costCenter = labelOf(meta, "costCenter");
  const category = labelOf(meta, "category");
  const chips = [
    reason && t("reason", { name: reason }),
    costCenter && t("costCenter", { name: costCenter }),
    category && t("category", { name: category }),
    start && t("effectiveStartDate", { date: formatDateOnly(start) }),
  ].filter((c): c is string => Boolean(c));
  if (!chips.length && !conditions) return null;
  return (
    <div className="mt-1.5 space-y-1.5">
      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <li
              key={chip}
              className={cn(
                "max-w-full truncate rounded-full px-2.5 py-0.5 text-xs font-medium",
                event.type === "REJECTED" ? "tonal-error" : "tonal-neutral"
              )}
              title={chip}
            >
              {chip}
            </li>
          ))}
        </ul>
      )}
      {conditions && (
        <p className="border-border rounded-md border px-3 py-2 text-sm break-words whitespace-pre-wrap">
          {t("conditions", { text: conditions })}
        </p>
      )}
    </div>
  );
}

export function ApprovalTimeline({ events }: { events: ApprovalEventView[] }) {
  const t = useTranslations("approvals.events");
  const tc = useTranslations("approvals.common");

  return (
    <ol className="space-y-5">
      {events.map((event) => {
        const Icon = ICONS[event.type];
        const key = eventKey(event);
        const isSystem = SYSTEM_EVENTS.has(key) || !event.actor;
        const stepLabel =
          typeof event.metadata?.stepLabel === "string"
            ? event.metadata.stepLabel
            : null;
        return (
          <li key={event.id} className="flex gap-3">
            <span
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                TONE[event.type]
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                {isSystem ? (
                  <span className="font-medium">{t(key)}</span>
                ) : (
                  <>
                    <span className="font-medium">
                      {userLabel(event.actor, tc("unknownUser"))}
                    </span>{" "}
                    <span className="text-muted-foreground">{t(key)}</span>
                  </>
                )}
                {stepLabel && (
                  <span className="text-muted-foreground"> · {stepLabel}</span>
                )}
              </p>
              <EventDetails event={event} />
              {event.comment && (
                <p className="bg-muted mt-1.5 rounded-md px-3 py-2 text-sm break-words whitespace-pre-wrap">
                  {event.comment}
                </p>
              )}
              <p className="text-muted-foreground mt-1 text-xs">
                {formatDateTime(event.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
