"use client";

// src/components/super-admin/analytics/spend-donut.tsx
/** Spend by category: thin donut with the monthly total and a ranked legend. */
import type { SpendSlice } from "@/types/platform-analytics";
import { PieChart as PieChartIcon } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import {
  money,
  moneyCompact,
  percentOf,
  seriesColor,
} from "./analytics-format";
import { ChartCard } from "./chart-card";

const DONUT_SIZE = 168;

interface SpendDonutProps {
  title: string;
  caption?: string;
  slices: SpendSlice[];
  currency: string;
}

export function SpendDonut({
  title,
  caption,
  slices,
  currency,
}: SpendDonutProps) {
  const total = slices.reduce((sum, s) => sum + s.monthly, 0);
  const visible = slices.filter((s) => s.monthly > 0);

  return (
    <ChartCard
      title={title}
      caption={caption}
      className="h-[380px]"
      testId="analytics-category-donut"
      empty={
        visible.length === 0
          ? { icon: PieChartIcon, message: "No active subscription spend." }
          : null
      }
    >
      <div className="@container flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-3 @lg:flex-row @lg:items-center @lg:gap-8">
          <div className="relative flex shrink-0 items-center justify-center">
            <ResponsiveContainer width={DONUT_SIZE} height={DONUT_SIZE}>
              <PieChart>
                <Pie
                  data={visible}
                  dataKey="monthly"
                  nameKey="label"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={visible.length > 1 ? 2 : 0}
                  stroke={visible.length > 1 ? "var(--card)" : "none"}
                >
                  {visible.map((s, i) => (
                    <Cell key={s.key} fill={seriesColor(i)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => money(Number(value), currency)}
                  contentStyle={{
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-muted-foreground text-xs">Per month</span>
              <span
                className="text-foreground max-w-[6.5rem] truncate text-base font-medium tabular-nums"
                title={money(total, currency)}
              >
                {moneyCompact(total, currency)}
              </span>
            </div>
          </div>
          <ul className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-y-auto @lg:max-h-full @lg:max-w-md @lg:justify-center">
            {visible.map((s, i) => (
              <li
                key={s.key}
                className="flex min-w-0 items-center gap-2 px-1 py-0.5 text-sm"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: seriesColor(i) }}
                  aria-hidden
                />
                <span className="min-w-0 truncate" title={s.label}>
                  {s.label}
                </span>
                <span
                  className="ml-auto w-24 shrink-0 truncate text-right text-xs tabular-nums"
                  title={money(s.monthly, currency)}
                >
                  {money(s.monthly, currency)}
                </span>
                <span className="text-muted-foreground w-9 shrink-0 text-right text-xs tabular-nums">
                  {percentOf(s.monthly, total)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ChartCard>
  );
}
