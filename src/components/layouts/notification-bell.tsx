// src/components/layouts/notification-bell.tsx
"use client";

/**
 * Header bell (11.1): unread badge polled every 60s, last 8 notifications,
 * mark-read on click, "mark all read" and "view all" → /notifications.
 */
import { NotificationRow } from "@/components/notifications/notification-item";
import {
  useMarkRead,
  useNotificationList,
  useUnreadCount,
} from "@/components/notifications/use-notifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BELL_PREVIEW_SIZE } from "@/lib/validations/notifications";
import type { NotificationItem } from "@/types/notification";
import { Bell, CheckCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const BADGE_MAX = 99;

export function NotificationBell() {
  const t = useTranslations("notifications.bell");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount();
  const list = useNotificationList({ limit: BELL_PREVIEW_SIZE });
  const markRead = useMarkRead();

  const count = unread.data ?? 0;
  const items = (list.data?.pages[0]?.items ?? []).slice(0, BELL_PREVIEW_SIZE);

  function openItem(item: NotificationItem) {
    if (!item.readAt) markRead.mutate({ ids: [item.id] });
    setOpen(false);
    if (item.link) router.push(item.link);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={count > 0 ? t("labelWithCount", { count }) : t("label")}
          className="relative"
        >
          <Bell className={cn("h-5 w-5", count > 0 && "animate-tada")} />
          {count > 0 && (
            <span
              data-testid="unread-badge"
              className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs font-bold tabular-nums"
            >
              {count > BADGE_MAX ? `${BADGE_MAX}+` : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] p-0 sm:w-96">
        <header className="flex items-center justify-between px-3 py-2.5">
          <p className="text-sm font-semibold">{t("title")}</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={count === 0 || markRead.isPending}
            onClick={() => markRead.mutate({ all: true })}
          >
            <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t("markAllRead")}
          </Button>
        </header>
        <div className="border-border/60 max-h-[26rem] overflow-y-auto border-y">
          {list.isLoading && (
            <div className="space-y-2 p-3" aria-busy="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}
          {!list.isLoading && items.length === 0 && (
            <p className="text-muted-foreground px-3 py-8 text-center text-sm">
              {t("empty")}
            </p>
          )}
          {!list.isLoading &&
            items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                dense
                onOpen={openItem}
              />
            ))}
        </div>
        <footer className="px-3 py-2">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="text-primary block text-center text-sm font-medium hover:underline"
          >
            {t("viewAll")}
          </Link>
        </footer>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
