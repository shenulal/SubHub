// src/components/notifications/notification-centre.tsx
"use client";

/**
 * /notifications (11.1): type-group filters, unread toggle, infinite list,
 * mark-all-read and deep links.
 */
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  NOTIFICATION_TYPE_GROUPS,
  type NotificationItem,
  type NotificationTypeGroup,
} from "@/types/notification";
import { CheckCheck, Inbox } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { NotificationRow } from "./notification-item";
import { FILTER_GROUPS, TYPE_GROUP_META } from "./notification-type-groups";
import { useMarkRead, useNotificationList } from "./use-notifications";

const PAGE_SIZE = 25;

export function NotificationCentre() {
  const t = useTranslations("notifications.centre");
  const tGroups = useTranslations("notifications.groups");
  const router = useRouter();
  const [group, setGroup] = useState<NotificationTypeGroup | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const filters = useMemo(
    () => ({
      limit: PAGE_SIZE,
      unreadOnly,
      types: group ? NOTIFICATION_TYPE_GROUPS[group] : undefined,
    }),
    [group, unreadOnly]
  );
  const list = useNotificationList(filters);
  const markRead = useMarkRead();

  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const unreadCount = list.data?.pages[0]?.unreadCount ?? 0;

  function openItem(item: NotificationItem) {
    if (!item.readAt) markRead.mutate({ ids: [item.id] });
    if (item.link) router.push(item.link);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        actions={[
          {
            label: t("markAllRead"),
            icon: CheckCheck,
            variant: "outline",
            disabled: unreadCount === 0 || markRead.isPending,
            onClick: () => markRead.mutate({ all: true }),
          },
        ]}
      />

      <section
        aria-label={t("filters")}
        className="flex flex-wrap items-center gap-2"
      >
        <FilterChip active={group === null} onClick={() => setGroup(null)}>
          {t("all")}
        </FilterChip>
        {FILTER_GROUPS.map((g) => {
          const Icon = TYPE_GROUP_META[g].icon;
          return (
            <FilterChip
              key={g}
              active={group === g}
              onClick={() => setGroup(g)}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {tGroups(TYPE_GROUP_META[g].labelKey)}
            </FilterChip>
          );
        })}
        <label className="text-muted-foreground ml-auto inline-flex items-center gap-2 text-sm">
          <Switch
            checked={unreadOnly}
            onCheckedChange={setUnreadOnly}
            aria-label={t("unreadOnly")}
          />
          {t("unreadOnly")}
          {unreadCount > 0 && (
            <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 font-mono text-xs tabular-nums">
              {unreadCount}
            </span>
          )}
        </label>
      </section>

      <section className="bg-card/50 divide-border/60 divide-y overflow-hidden rounded-xl border shadow-sm">
        {list.isLoading && (
          <div className="space-y-3 p-4" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}
        {list.isError && (
          <p className="text-destructive px-4 py-10 text-center text-sm">
            {t("error")}
          </p>
        )}
        {!list.isLoading && !list.isError && items.length === 0 && (
          <div className="text-muted-foreground flex flex-col items-center gap-3 px-4 py-16 text-center">
            <span className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
              <Inbox className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="text-sm">
              {unreadOnly ? t("emptyUnread") : t("empty")}
            </p>
          </div>
        )}
        {items.map((item) => (
          <NotificationRow key={item.id} item={item} onOpen={openItem} />
        ))}
      </section>

      {list.hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => list.fetchNextPage()}
            disabled={list.isFetchingNextPage}
          >
            {list.isFetchingNextPage ? t("loading") : t("loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function FilterChip({ active, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
        active
          ? "bg-foreground text-background border-foreground shadow-sm"
          : "bg-background text-muted-foreground hover:text-foreground hover:border-foreground/40"
      )}
    >
      {children}
    </button>
  );
}
