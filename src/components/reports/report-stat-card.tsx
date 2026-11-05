// src/components/reports/report-stat-card.tsx
// Materio card-statistics (vertical) pattern: icon tile, title, value, caption.
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type StatTone = "primary" | "success" | "warning" | "info" | "error";

const TONE_TILE: Record<StatTone, string> = {
  primary: "tonal-primary",
  success: "tonal-success",
  warning: "tonal-warning",
  info: "tonal-info",
  error: "tonal-error",
};

const TONE_TEXT: Record<StatTone, string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  error: "text-error",
};

interface ReportStatCardProps {
  icon: LucideIcon;
  title: string;
  value: string;
  tone?: StatTone;
  /** Colour the value itself with the tone (e.g. waste / savings figures). */
  toneValue?: boolean;
  caption?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function ReportStatCard({
  icon: Icon,
  title,
  value,
  tone = "primary",
  toneValue = false,
  caption,
  className,
  children,
}: ReportStatCardProps) {
  return (
    <Card className={cn("h-full gap-4 px-5", className)}>
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-md",
          TONE_TILE[tone]
        )}
      >
        <Icon className={cn("size-[22px]", TONE_TEXT[tone])} aria-hidden />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <p
          className="text-muted-foreground truncate text-[0.8125rem]"
          title={title}
        >
          {title}
        </p>
        <p
          className={cn(
            "truncate text-2xl font-medium tabular-nums",
            toneValue ? TONE_TEXT[tone] : "text-foreground"
          )}
          title={value}
        >
          {value}
        </p>
        {caption ? (
          <div className="text-muted-foreground min-w-0 truncate text-[0.8125rem]">
            {caption}
          </div>
        ) : null}
        {children}
      </div>
    </Card>
  );
}
