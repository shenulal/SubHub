// src/components/receipts/confidence-meter.tsx
"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { confidenceLevel, type ConfidenceLevel } from "./receipts.utils";

const LEVEL_STYLES: Record<ConfidenceLevel, { bar: string; text: string }> = {
  high: {
    bar: "bg-success",
    text: "text-success",
  },
  medium: {
    bar: "bg-warning",
    text: "text-warning",
  },
  low: {
    bar: "bg-error",
    text: "text-error",
  },
};

interface ConfidenceMeterProps {
  value: number;
  className?: string;
  compact?: boolean;
}

/** Three-stop confidence meter (0–1) with a semantic colour per bucket. */
export function ConfidenceMeter({
  value,
  className,
  compact,
}: ConfidenceMeterProps) {
  const t = useTranslations("receipts.common.confidence");
  const level = confidenceLevel(value);
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const styles = LEVEL_STYLES[level];

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={`${t("label")}: ${t(level)} (${percent}%)`}
      data-level={level}
    >
      <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            styles.bar
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={cn("text-xs font-medium tabular-nums", styles.text)}>
        {compact ? `${percent}%` : `${t(level)} · ${percent}%`}
      </span>
    </div>
  );
}
