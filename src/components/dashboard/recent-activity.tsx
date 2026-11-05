// src/components/dashboard/recent-activity.tsx
"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { RecentActivityItem } from "@/types/dashboard";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import { History } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { DashboardEmptyState } from "./dashboard-empty-state";

const CARD_CLASSES = "h-[440px] gap-4 overflow-clip px-5";

interface RecentActivityProps {
  activities: RecentActivityItem[];
  isLoading?: boolean;
}

/**
 * Recent activity list component
 * - Figma design: card-style item layout
 * - Background: purple-gray (rgba(100, 116, 243, 0.05))
 * - Avatar: 40x40 circle
 * - Height: h-[450px] (same as Apps by category)
 */
export function RecentActivity({ activities, isLoading }: RecentActivityProps) {
  const t = useTranslations();
  const dateLocale = enUS;

  // Show only the 5 most recent activities
  const displayActivities = useMemo(() => {
    return activities.slice(0, 5);
  }, [activities]);

  // Loading state
  if (isLoading) {
    return (
      <Card className={CARD_CLASSES}>
        <Skeleton className="h-6 w-24" />
        <div className="flex flex-1 flex-col gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded" />
          ))}
        </div>
      </Card>
    );
  }

  // Empty state
  if (!displayActivities || displayActivities.length === 0) {
    return (
      <Card className={CARD_CLASSES}>
        <p className="text-foreground truncate text-lg font-medium">
          {t("dashboard.sections.recentActivity.title")}
        </p>
        <DashboardEmptyState
          icon={History}
          message={t("dashboard.recentActivity.empty")}
        />
      </Card>
    );
  }

  return (
    <Card className={CARD_CLASSES}>
      {/* Title */}
      <p className="text-foreground truncate text-lg font-medium">
        {t("dashboard.sections.recentActivity.title")}
      </p>

      {/* Activity list */}
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {displayActivities.map((activity) => {
          const displayName =
            activity.userName ??
            activity.userEmail ??
            t("dashboard.recentActivity.system");
          const initials = displayName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          const timeAgo = formatDistanceToNow(new Date(activity.createdAt), {
            addSuffix: true,
            locale: dateLocale,
          });

          return (
            <div
              key={activity.id}
              className="hover:bg-muted flex min-w-0 items-center gap-3 rounded-md p-2 transition-colors"
            >
              {/* Avatar */}
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="bg-primary/15 text-primary text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>

              {/* Content */}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
                <p className="text-foreground truncate text-sm font-medium">
                  {displayName}
                </p>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate">
                    {activity.description}
                  </span>
                  <span className="shrink-0 whitespace-nowrap">{timeAgo}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
