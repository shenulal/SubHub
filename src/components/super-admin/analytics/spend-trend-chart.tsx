"use client";

// src/components/super-admin/analytics/spend-trend-chart.tsx
/** Monthly run-rate per month (area chart, same look as the tenant dashboard). */
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { SpendPoint } from "@/types/platform-analytics";
import { TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { formatMonth, money, moneyCompact } from "./analytics-format";
import { ChartCard } from "./chart-card";

interface SpendTrendChartProps {
  data: SpendPoint[];
  currency: string;
  title?: string;
  caption?: string;
}

export function SpendTrendChart({
  data,
  currency,
  title = "Spend trend",
  caption,
}: SpendTrendChartProps) {
  // Fixed ids: React useId differs between the RSC render and hydration here.
  const gradientId = "analytics-spend-trend-fill";
  const config = {
    monthly: { label: "Monthly run-rate", color: "var(--chart-1)" },
  } satisfies ChartConfig;
  const empty = data.every((p) => p.monthly === 0);

  return (
    <ChartCard
      title={title}
      caption={caption ?? `Monthly-equivalent cost per month, in ${currency}`}
      className="h-[380px]"
      testId="analytics-spend-trend"
      empty={
        empty
          ? {
              icon: TrendingUp,
              message: "No subscription spend in this period.",
            }
          : null
      }
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        <ChartContainer
          id="analytics-spend-trend"
          config={config}
          className="h-full w-full"
        >
          <AreaChart
            data={data}
            margin={{ top: 10, right: 12, left: 4, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--chart-1)"
                  stopOpacity={0.24}
                />
                <stop
                  offset="100%"
                  stopColor="var(--chart-1)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tickFormatter={formatMonth}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              minTickGap={16}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={64}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              tickFormatter={(v: number) => moneyCompact(v, currency)}
            />
            <ChartTooltip
              content={(props) => (
                <ChartTooltipContent
                  active={props.active}
                  label={formatMonth(String(props.label ?? ""))}
                  payload={props.payload ?? []}
                  formatter={(value) => (
                    <div className="flex w-full items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        {config.monthly.label}
                      </span>
                      <span className="font-medium tabular-nums">
                        {money(Number(value), currency)}
                      </span>
                    </div>
                  )}
                />
              )}
            />
            <Area
              type="monotone"
              dataKey="monthly"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={data.length <= 2}
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </ChartCard>
  );
}
