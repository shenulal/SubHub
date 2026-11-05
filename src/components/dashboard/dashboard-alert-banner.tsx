"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronRight, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

export interface DashboardAlertItem {
  id: string;
  severity: "info" | "warning" | "critical";
  titleKey: string;
  messageKey: string;
  href?: string;
  titleParams?: Record<string, string | number>;
  messageParams?: Record<string, string | number>;
}

interface DashboardAlertBannerProps {
  alerts: DashboardAlertItem[];
}

/** Materio tonal icon tile per severity. */
const severityTile = {
  info: "tonal-info",
  warning: "tonal-warning",
  critical: "tonal-error",
} as const;

const ROW_CLASSES =
  "flex min-w-0 items-center gap-3 rounded-md px-3 py-2.5 transition-colors";

/**
 * Compact Materio alert list: one card, one row per alert (tonal icon tile,
 * single-line title + description, chevron when the row links somewhere).
 */
export function DashboardAlertBanner({ alerts }: DashboardAlertBannerProps) {
  const t = useTranslations("dashboardV3.alertBanner");

  if (alerts.length === 0) return null;

  return (
    <Card className="gap-0 p-2">
      <div className="grid gap-1 xl:grid-cols-2 xl:gap-x-4">
        {alerts.map((alert) => {
          const Icon = alert.severity === "info" ? Info : AlertTriangle;
          const title = t(alert.titleKey, alert.titleParams);
          const message = t(alert.messageKey, alert.messageParams);

          const content = (
            <>
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-md",
                  severityTile[alert.severity]
                )}
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className="text-foreground truncate text-[0.9375rem] leading-snug font-medium"
                  title={title}
                >
                  {title}
                </p>
                <p
                  className="text-muted-foreground truncate text-[0.8125rem] leading-snug"
                  title={message}
                >
                  {message}
                </p>
              </div>
            </>
          );

          return alert.href ? (
            <Link
              key={alert.id}
              href={alert.href}
              className={cn(
                ROW_CLASSES,
                "hover:bg-muted focus-visible:ring-primary no-underline focus-visible:ring-2 focus-visible:outline-none"
              )}
            >
              {content}
              <ChevronRight
                className="text-muted-foreground size-4 shrink-0"
                aria-hidden
              />
            </Link>
          ) : (
            <div key={alert.id} className={ROW_CLASSES}>
              {content}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
