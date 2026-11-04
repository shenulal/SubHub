// src/components/notifications/notification-item.tsx
"use client";

import { cn } from "@/lib/utils";
import { groupOfType, type NotificationItem } from "@/types/notification";
import { useFormatter, useTranslations } from "next-intl";
import { TYPE_GROUP_META } from "./notification-type-groups";

export interface NotificationRowProps {
  item: NotificationItem;
  /** Compact rows for the bell dropdown. */
  dense?: boolean;
  onOpen: (item: NotificationItem) => void;
}

export function NotificationRow({
  item,
  dense = false,
  onOpen,
}: NotificationRowProps) {
  const t = useTranslations("notifications");
  const format = useFormatter();
  const meta = TYPE_GROUP_META[groupOfType(item.type)];
  const Icon = meta.icon;
  const unread = !item.readAt;
  const created = new Date(item.createdAt);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-label={unread ? `${item.title} (${t("centre.unread")})` : item.title}
      data-unread={unread ? "true" : "false"}
      className={cn(
        "group flex w-full items-start gap-3 border-l-2 text-left transition-colors",
        "hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none",
        unread ? meta.accentClass : "border-l-transparent",
        unread ? "bg-card" : "bg-transparent",
        dense ? "px-3 py-2.5" : "px-4 py-3.5 sm:px-5"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex shrink-0 items-center justify-center rounded-lg",
          meta.iconClass,
          dense ? "h-7 w-7" : "h-9 w-9"
        )}
        aria-hidden="true"
      >
        <Icon className={dense ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span
            className={cn(
              "truncate leading-snug",
              dense ? "text-sm" : "text-[15px]",
              unread
                ? "text-foreground font-semibold"
                : "text-foreground/85 font-medium"
            )}
          >
            {item.title}
          </span>
          <time
            dateTime={item.createdAt}
            className="text-muted-foreground shrink-0 font-mono text-[11px] tabular-nums"
          >
            {format.relativeTime(created)}
          </time>
        </span>
        {item.body && (
          <span
            className={cn(
              "text-muted-foreground mt-0.5 block leading-snug",
              dense ? "line-clamp-1 text-xs" : "line-clamp-2 text-sm"
            )}
          >
            {item.body}
          </span>
        )}
        {!dense && (
          <span className="text-muted-foreground/80 mt-1.5 inline-flex items-center gap-1.5 text-[11px] tracking-wide uppercase">
            {t(`groups.${meta.labelKey}`)}
          </span>
        )}
      </span>
      {unread && (
        <span
          className="bg-primary mt-2 h-2 w-2 shrink-0 rounded-full"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
