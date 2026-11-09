// src/components/super-admin/analytics/ranked-list.tsx
/** Ranked horizontal bars (spend by team / cost centre, counts by status / role). */
import { cn } from "@/lib/utils";

import { percentOf } from "./analytics-format";

export interface RankedItem {
  key: string;
  label: string;
  value: number;
  /** Formatted value shown on the right. */
  display: string;
  hint?: string;
}

export function RankedList({
  items,
  barClassName = "bg-primary",
  testId,
}: {
  items: RankedItem[];
  barClassName?: string;
  testId?: string;
}) {
  const max = Math.max(0, ...items.map((i) => i.value));
  return (
    <ul className="flex min-h-0 flex-1 flex-col gap-3" data-testid={testId}>
      {items.map((item) => (
        <li key={item.key} className="min-w-0 space-y-1.5">
          <div className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate" title={item.label}>
              {item.label}
            </span>
            <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
              {item.hint && (
                <span className="text-muted-foreground text-xs">
                  {item.hint}
                </span>
              )}
              <span className="font-medium">{item.display}</span>
            </span>
          </div>
          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
            <div
              className={cn("h-full rounded-full", barClassName)}
              style={{ width: `${Math.max(2, percentOf(item.value, max))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
