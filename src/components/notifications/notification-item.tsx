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
        "group flex w-full min-w-0 items-center gap-3 border-l-2 text-left transition-colors sm:gap-4",
        "hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
        unread ? meta.accentClass : "border-l-transparent",
        unread ? "bg-primary/[0.04]" : "bg-transparent",
        dense ? "gap-3 px-3 py-2.5 sm:gap-3" : "px-4 py-3.5 sm:px-5"
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md",
          meta.iconClass,
          dense ? "size-8" : "size-10"
        )}
        aria-hidden="true"
      >
        <Icon className={dense ? "size-4" : "size-5"} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
        <span
          className={cn(
            "text-foreground block truncate leading-snug",
            dense ? "text-sm" : "text-[0.9375rem]",
            unread ? "font-medium" : "font-normal"
          )}
          title={item.title}
        >
          {item.title}
        </span>
        {item.body && (
          <span
            className={cn(
              "text-muted-foreground block truncate leading-snug",
              dense ? "text-xs" : "text-[0.8125rem]"
            )}
            title={item.body}
          >
            {item.body}
          </span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1 self-start whitespace-nowrap">
        <span className="flex items-center gap-2">
          <time
            dateTime={item.createdAt}
            className="text-muted-foreground text-xs tabular-nums"
          >
            {format.relativeTime(created)}
          </time>
          {unread && (
            <span
              className="bg-primary size-2 shrink-0 rounded-full"
              aria-hidden="true"
            />
          )}
        </span>
        {!dense && (
          <span className="text-muted-foreground hidden text-[0.6875rem] tracking-wide uppercase sm:inline">
            {t(`groups.${meta.labelKey}`)}
          </span>
        )}
      </span>
    </button>
  );
}
