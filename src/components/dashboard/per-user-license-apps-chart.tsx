"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { TopLicenseApp } from "@/types/dashboard";
import { KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { DashboardEmptyState } from "./dashboard-empty-state";

export interface PerUserLicenseAppsChartProps {
  data: TopLicenseApp[];
  isLoading?: boolean;
}

const CARD_CLASSES = "h-[440px] gap-4 overflow-clip px-5";

/** rank | app name (truncating) | usage | issued */
const ROW_GRID =
  "grid grid-cols-[2rem_minmax(0,1fr)_3.5rem_3.5rem] items-center gap-3";

// Extract app name initials
function getAppInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

// Colour derived from the app name (avatar background, Materio tonal tokens)
function getAppColor(name: string): string {
  const colors: Record<string, string> = {
    S: "tonal-primary",
    N: "tonal-neutral",
    F: "tonal-error",
    C: "tonal-success",
    M: "tonal-warning",
    G: "tonal-info",
  };
  const initial = getAppInitial(name);
  return colors[initial] || "tonal-neutral";
}

/**
 * Top 5 licence allocations (Materio list table)
 * - Columns: rank, app name, used, allocated
 * - Long app names truncate with a tooltip so numbers stay aligned.
 */
export function PerUserLicenseAppsChart({
  data,
  isLoading,
}: PerUserLicenseAppsChartProps) {
  const t = useTranslations("dashboard2.licenseApps");

  // Sorted data (by allocations descending, top 5)
  const sortedData = useMemo(() => {
    return [...data].slice(0, 5);
  }, [data]);

  // Loading state
  if (isLoading) {
    return (
      <Card className={CARD_CLASSES}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="flex-1" />
      </Card>
    );
  }

  return (
    <Card className={CARD_CLASSES}>
      {/* Header: title */}
      <p
        className="text-foreground truncate text-lg font-medium"
        title={t("title")}
      >
        {t("title")}
      </p>

      {sortedData.length === 0 ? (
        <DashboardEmptyState icon={KeyRound} message={t("empty")} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Header row */}
          <div
            className={cn(
              ROW_GRID,
              "border-border text-muted-foreground h-10 border-b px-2 text-xs font-medium"
            )}
          >
            <span className="text-center">{t("rank")}</span>
            <span className="truncate">{t("appName")}</span>
            <span className="truncate text-right">{t("usage")}</span>
            <span className="truncate text-right">{t("issued")}</span>
          </div>

          {/* Data rows */}
          <ul className="divide-border flex min-h-0 flex-1 flex-col divide-y overflow-y-auto">
            {sortedData.map((app, index) => (
              <li key={app.appId} className={cn(ROW_GRID, "h-[52px] px-2")}>
                <div className="flex justify-center">
                  <RankBadge rank={index + 1} />
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "flex size-[30px] shrink-0 items-center justify-center rounded-md text-sm font-medium",
                      getAppColor(app.appName)
                    )}
                  >
                    {getAppInitial(app.appName)}
                  </span>
                  <span
                    className="text-foreground truncate text-sm font-medium"
                    title={app.appName}
                  >
                    {app.appName}
                  </span>
                </div>
                <span className="text-muted-foreground text-right text-sm tabular-nums">
                  {app.usageCount ?? 0}
                </span>
                <span className="text-foreground text-right text-sm font-medium tabular-nums">
                  {app.userCount.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/**
 * Rank badge component
 * - Rank 1: primary background
 * - Ranks 2-5: tonal primary
 */
function RankBadge({ rank }: { rank: number }) {
  return (
    <div
      className={cn(
        "flex size-6 items-center justify-center rounded-sm text-xs font-medium tabular-nums",
        rank === 1 ? "bg-primary text-primary-foreground" : "tonal-primary"
      )}
    >
      {rank}
    </div>
  );
}
