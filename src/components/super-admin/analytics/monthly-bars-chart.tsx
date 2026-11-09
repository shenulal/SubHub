"use client";

// src/components/super-admin/analytics/monthly-bars-chart.tsx
/** Grouped monthly counts (growth, sign-ins) with a compact legend. */
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { LogIn, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { formatMonth, seriesColor } from "./analytics-format";
import { ChartCard } from "./chart-card";

/** Icons are chosen here: server components cannot pass components as props. */
const EMPTY_ICONS = { growth: TrendingUp, signIns: LogIn } as const;

export interface BarSeries<T> {
  key: Extract<keyof T, string>;
  label: string;
}

interface MonthlyBarsChartProps<T extends { month: string }> {
  title: string;
  caption?: string;
  data: T[];
  series: BarSeries<T>[];
  emptyIcon: keyof typeof EMPTY_ICONS;
  emptyMessage: string;
  /** Also the chart's style scope id (must be unique on the page). */
  testId: string;
}

export function MonthlyBarsChart<T extends { month: string }>({
  title,
  caption,
  data,
  series,
  emptyIcon,
  emptyMessage,
  testId,
}: MonthlyBarsChartProps<T>) {
  const config: ChartConfig = Object.fromEntries(
    series.map((s, i) => [s.key, { label: s.label, color: seriesColor(i) }])
  );
  const empty = data.every((row) =>
    series.every((s) => Number(row[s.key] ?? 0) === 0)
  );

  return (
    <ChartCard
      title={title}
      caption={caption}
      className="h-[380px]"
      testId={testId}
      empty={
        empty ? { icon: EMPTY_ICONS[emptyIcon], message: emptyMessage } : null
      }
    >
      <ul className="flex min-w-0 flex-wrap gap-x-4 gap-y-1">
        {series.map((s, i) => (
          <li
            key={s.key}
            className="text-muted-foreground flex items-center gap-1.5 text-xs"
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: seriesColor(i) }}
              aria-hidden
            />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="min-h-0 flex-1 overflow-hidden">
        <ChartContainer id={testId} config={config} className="h-full w-full">
          <BarChart
            data={data}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            barGap={2}
          >
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tickFormatter={formatMonth}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              minTickGap={12}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              width={36}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            />
            <ChartTooltip
              cursor={{ fill: "var(--muted)" }}
              content={(props) => (
                <ChartTooltipContent
                  active={props.active}
                  label={formatMonth(String(props.label ?? ""))}
                  payload={props.payload ?? []}
                />
              )}
            />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={seriesColor(i)}
                radius={[3, 3, 0, 0]}
                maxBarSize={18}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </div>
    </ChartCard>
  );
}
