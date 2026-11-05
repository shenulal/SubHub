"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { LowUtilizationApp } from "@/types/dashboard";
import { Armchair } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { DashboardEmptyState } from "./dashboard-empty-state";

const CARD_CLASSES = "h-[440px] gap-4 px-5";

export interface SeatUtilizationChartProps {
  data: LowUtilizationApp[];
  isLoading?: boolean;
}

// Chart data type
interface ChartData {
  name: string;
  fullName: string;
  assigned: number;
  total: number;
  rate: number;
}

// Extract app name initials
function getAppInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

// Colour derived from the app name
function getAppColor(name: string): string {
  const colors: Record<string, string> = {
    S: "tonal-warning",
    N: "tonal-primary",
    F: "tonal-error",
    J: "tonal-info",
    Z: "tonal-success",
  };
  const initial = getAppInitial(name);
  return colors[initial] || "tonal-neutral";
}

// Custom X-axis tick component (shows app avatars)
interface CustomAvatarTickProps {
  x?: number | string;
  y?: number | string;
  payload?: { value: string };
  chartData: ChartData[];
}

function CustomAvatarTick({
  x = 0,
  y = 0,
  payload,
  chartData,
}: CustomAvatarTickProps) {
  if (!payload?.value) return null;

  const app = chartData.find((d) => d.name === payload.value);
  if (!app) return null;

  const initial = getAppInitial(app.fullName);
  const colorClass = getAppColor(app.fullName);

  return (
    <g transform={`translate(${Number(x)},${Number(y) + 8})`}>
      <foreignObject x={-16} y={0} width={32} height={32}>
        <Avatar className="h-8 w-8 rounded-md">
          <AvatarFallback className="rounded-md bg-transparent text-sm font-medium">
            <span
              className={`flex size-full items-center justify-center rounded-md ${colorClass}`}
            >
              {initial}
            </span>
          </AvatarFallback>
        </Avatar>
      </foreignObject>
    </g>
  );
}

/**
 * Bottom 5 seat utilisation chart component (vertical bar chart)
 * - Figma design: vertical bar chart
 * - Y axis: 0%, 10%, 20%, 30%, 40%, 50%
 * - X axis: app avatars
 * - Bar style: purple theme
 */
export function SeatUtilizationChart({
  data,
  isLoading,
}: SeatUtilizationChartProps) {
  const t = useTranslations("dashboard2.seatUtilization");

  // Sorted data (lowest utilisation first, top 5)
  const sortedData = useMemo(() => {
    return [...data].slice(0, 5);
  }, [data]);

  // Build ChartConfig dynamically
  const chartConfig = useMemo(() => {
    if (!sortedData.length) return {} as ChartConfig;
    const config: ChartConfig = {
      rate: { label: t("rate") },
    };
    return config;
  }, [sortedData, t]);

  // Convert to Recharts-compatible data
  const chartData: ChartData[] = useMemo(() => {
    if (!sortedData.length) return [];
    return sortedData.map((app) => ({
      name:
        app.appName.length > 8 ? app.appName.slice(0, 8) + "…" : app.appName,
      fullName: app.appName,
      assigned: app.assignedSeats,
      total: app.totalSeats,
      rate: app.utilizationRate,
    }));
  }, [sortedData]);

  // Loading state
  if (isLoading) {
    return (
      <Card className={CARD_CLASSES}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="flex-1" />
      </Card>
    );
  }

  // Empty state
  if (!sortedData.length) {
    return (
      <Card className={CARD_CLASSES}>
        <p
          className="text-foreground truncate text-lg font-medium"
          title={t("title")}
        >
          {t("title")}
        </p>
        <DashboardEmptyState icon={Armchair} message={t("empty")} />
      </Card>
    );
  }

  return (
    <Card className={CARD_CLASSES}>
      {/* Header: title */}
      <p
        className="text-foreground truncate text-lg font-medium"
        title={t("title")}
      >
        {t("title")}
      </p>

      {/* Chart area */}
      <div className="min-h-0 flex-1">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 50 }}
          >
            <CartesianGrid
              horizontal={true}
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="0"
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={(props) => (
                <CustomAvatarTick {...props} chartData={chartData} />
              )}
              interval={0}
            />
            <YAxis
              domain={[0, 50]}
              ticks={[0, 10, 20, 30, 40, 50]}
              tickFormatter={(v) => `${v}%`}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              width={40}
            />
            <ChartTooltip
              content={(props) => (
                <ChartTooltipContent
                  active={props.active}
                  label={props.label}
                  payload={props.payload ?? []}
                  formatter={(value, name, item) => (
                    <div className="flex w-full flex-col gap-1">
                      <div className="mb-1 font-medium">
                        {item.payload?.fullName}
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">
                          {t("assigned")}
                        </span>
                        <span className="font-mono font-medium tabular-nums">
                          {item.payload?.assigned ?? 0}/
                          {item.payload?.total ?? 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">
                          {t("rate")}
                        </span>
                        <span className="font-mono font-medium tabular-nums">
                          {item.payload?.rate ?? 0}%
                        </span>
                      </div>
                    </div>
                  )}
                />
              )}
            />
            <Bar dataKey="rate" radius={[4, 4, 0, 0]} barSize={40}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill="color-mix(in oklab, var(--chart-1) 24%, transparent)"
                  stroke="var(--chart-1)"
                  strokeWidth={1}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
    </Card>
  );
}
