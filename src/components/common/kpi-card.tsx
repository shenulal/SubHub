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
  /** CardFooter에 표시할 트렌드 요약 문구 */
  trendSummary?: string;
  href?: string;
  className?: string;
}

/**
 * 개선된 KPI 카드 컴포넌트 (shadcn dashboard-01 패턴)
 * - @container 쿼리 기반 반응형
 * - CardAction 슬롯에 트렌드 Badge
 * - CardFooter에 트렌드 요약 문구
 * - Color Theme Guide 준수 배경색 + shadow-xs
 * - tabular-nums 숫자 정렬
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
 * KPI 카드 그리드 컨테이너
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
