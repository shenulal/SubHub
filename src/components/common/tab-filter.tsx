"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import * as React from "react";

/**
 * Tab filter item type
 */
export interface TabFilterItem<T extends string = string> {
  value: T;
  label: string;
  count?: number;
  variant?: "default" | "success" | "warning" | "danger" | "secondary";
}

/**
 * Tab filter props
 */
interface TabFilterProps<T extends string = string> {
  items: TabFilterItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Badge colour mapping
 */
const badgeVariantStyles: Record<string, string> = {
  default: "tonal-primary",
  success: "tonal-success",
  warning: "tonal-warning",
  danger: "tonal-error",
  secondary: "tonal-neutral",
};

/**
 * Tab filter component
 * Reference: top of the Orders page (All / Completed / Processed / Returned / Canceled)
 */
export function TabFilter<T extends string = string>({
  items,
  value,
  onChange,
  className,
}: TabFilterProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-1",
        className
      )}
    >
      {items.map((item) => {
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              "focus-visible:ring-primary/20 inline-flex h-[38px] shrink-0 items-center justify-center rounded-md px-4 text-[0.9375rem] font-medium whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
              isActive
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-foreground hover:bg-primary/10 hover:text-primary"
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <Badge
                variant="secondary"
                className={cn(
                  "ml-2 h-5 min-w-[20px] rounded-full px-1.5 text-xs tabular-nums",
                  isActive &&
                    "bg-primary-foreground/20 text-primary-foreground dark:text-primary-foreground",
                  !isActive && item.variant
                    ? badgeVariantStyles[item.variant]
                    : ""
                )}
              >
                {item.count}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * useTabFilter hook - manages tab filter state
 */
export function useTabFilter<T extends string>(defaultValue: T) {
  const [value, setValue] = React.useState<T>(defaultValue);
  return {
    value,
    setValue,
    onChange: setValue,
  };
}
