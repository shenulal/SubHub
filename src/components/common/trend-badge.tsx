"use client";

import { cn } from "@/lib/utils";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

export interface TrendBadgeProps {
  /** Percentage value (positive = up, negative = down, 0 = flat) */
  value: number;
  /** Additional label (e.g. "increase", "vs last month") */
  label?: string;
  /** Which direction is semantically positive (default: 'up') */
  positiveDirection?: "up" | "down";
  /** 'pill' = chip with background, 'inline' = text only */
  variant?: "pill" | "inline";
  /** Icon size: 'md' = h-4 w-4, 'sm' = h-3 w-3 */
  iconSize?: "md" | "sm";
  /** Number of decimal places for the percentage (default: 0) */
  decimalPlaces?: number;
  className?: string;
}

export function TrendBadge({
  value,
  label,
  positiveDirection = "up",
  variant = "pill",
  iconSize = "md",
  decimalPlaces = 0,
  className,
}: TrendBadgeProps) {
  const direction = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const isPositive =
    direction === "flat"
      ? null
      : (direction === "up") === (positiveDirection === "up");

  const Icon =
    direction === "up"
      ? TrendingUp
      : direction === "down"
        ? TrendingDown
        : Minus;

  const colorClass =
    isPositive === null
      ? "text-muted-foreground"
      : isPositive
        ? "text-success"
        : "text-destructive";

  const bgClass =
    isPositive === null
      ? "tonal-neutral"
      : isPositive
        ? "tonal-success"
        : "tonal-error";

  const iconClass = iconSize === "sm" ? "size-3" : "size-4";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-[0.8125rem] font-medium whitespace-nowrap tabular-nums",
        colorClass,
        variant === "pill" && cn("rounded-full px-2 py-0.5", bgClass),
        className
      )}
    >
      <Icon className={iconClass} />
      {value > 0 ? "+" : ""}
      {Math.abs(value).toFixed(decimalPlaces)}%
      {label && <span className="font-normal">{label}</span>}
    </span>
  );
}
