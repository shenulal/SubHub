"use client";

import { ArrowDown, ArrowRight, ArrowUp, LucideIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  change?: {
    value: number;
    type: "increase" | "decrease" | "neutral";
  };
  /** Trend summary text shown in the CardFooter */
  trendSummary?: string;
  href?: string;
  className?: string;
}

/**
 * Enhanced KPI card component (shadcn dashboard-01 pattern)
 * - Responsive via @container queries
 * - Trend badge in the CardAction slot
 * - Trend summary text in the CardFooter
 * - Background colours per the Color Theme Guide + shadow-xs
 * - tabular-nums number alignment
 */
export function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  change,
  trendSummary,
  href,
  className,
}: KpiCardProps) {
  const isPositive = change?.type === "increase";
  const isNegative = change?.type === "decrease";

  return (
    <Card className={cn("@container/card gap-3", className)}>
      <CardHeader className="gap-3">
        {Icon && (
          <div className="tonal-primary flex size-10 items-center justify-center rounded-md">
            <Icon className="size-[22px]" />
          </div>
        )}
        <div className="min-w-0 space-y-1">
          <CardDescription className="truncate" title={title}>
            {title}
          </CardDescription>
          {/* Trend chip follows the value so the title keeps the full width */}
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <CardTitle
              data-kpi
              className="kpi-value text-foreground min-w-0"
              title={String(value)}
            >
              {value}
            </CardTitle>
            {change && (
              <Badge
                variant={
                  isPositive ? "success" : isNegative ? "error" : "neutral"
                }
                className="shrink-0 gap-1 text-xs font-medium"
              >
                {isPositive && <ArrowUp className="size-3" />}
                {isNegative && <ArrowDown className="size-3" />}
                {change.value > 0 ? "+" : ""}
                {change.value}%
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      {(description || trendSummary || href) && (
        <CardFooter className="min-w-0 flex-col items-start gap-1">
          {description && (
            <div
              className="text-muted-foreground w-full truncate text-[0.8125rem]"
              title={description}
            >
              {description}
            </div>
          )}
          {trendSummary && (
            <div
              className={cn(
                "flex w-full min-w-0 items-center gap-1.5 text-[0.8125rem] font-medium",
                isPositive && "text-success",
                isNegative && "text-error"
              )}
            >
              <span className="truncate">{trendSummary}</span>
              {isPositive && <ArrowUp className="size-3 shrink-0" />}
              {isNegative && <ArrowDown className="size-3 shrink-0" />}
            </div>
          )}
          {href && (
            <Link
              href={href}
              className="text-primary inline-flex items-center text-[0.8125rem] font-medium hover:underline"
            >
              View more
              <ArrowRight className="ml-1 size-3" />
            </Link>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

/**
 * KPI card grid container
 */
interface KpiCardsGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function KpiCardsGrid({
  children,
  columns = 4,
  className,
}: KpiCardsGridProps) {
  return (
    <div
      className={cn(
        "grid gap-6",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}
