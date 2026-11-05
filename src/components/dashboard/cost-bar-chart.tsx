"use client";

import { Card } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DEFAULT_BASE_CURRENCY, formatMoney } from "@/lib/fx/convert";
import { useLocale, useTranslations } from "next-intl";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

export interface MonthlyBarData {
  month: string;
  displayLabel: string;
  saasCost: number;
  nonSaasCost: number;
  isCurrentMonth?: boolean;
}

interface CostBarChartProps {
  data: MonthlyBarData[];
  period: string;
  onPeriodChange?: (period: string) => void;
  /** Organisation base currency (trend amounts are already in it). */
  currency?: string;
}

/** Shared Materio segmented-control item style (one line, fixed width). */
const PERIOD_ITEM_CLASSES =
  "text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-primary h-7 w-12 shrink-0 rounded-sm px-3 text-xs whitespace-nowrap data-[state=on]:font-medium data-[state=on]:shadow-xs";

function formatMonthShort(yearMonth: string): string {
  const [, month] = yearMonth.split("-").map(Number);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return months[month - 1] || yearMonth;
}

export function CostBarChart({
  data,
  period,
  onPeriodChange,
  currency = DEFAULT_BASE_CURRENCY,
}: CostBarChartProps) {
  const t = useTranslations("dashboardV2Cost.chart");
  const locale = useLocale();
  const formatCurrency = (amount: number) =>
    formatMoney(amount, currency, locale);

  const monthsToShow = parseInt(period);
  const chartData = data.slice(-monthsToShow);

  const chartConfig = {
    saasCost: {
      label: t("saasCost"),
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  return (
    <Card className="h-[400px] gap-4 overflow-hidden px-5">
      {/* Header: title + period tabs */}
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p
          className="text-foreground min-w-0 truncate text-lg font-medium"
          title={t("title")}
        >
          {t("title")}
        </p>
        {onPeriodChange && (
          <ToggleGroup
            type="single"
            value={period}
            onValueChange={(value) => value && onPeriodChange(value)}
            className="bg-muted shrink-0 gap-0 rounded-md p-[3px]"
          >
            <ToggleGroupItem value="3" className={PERIOD_ITEM_CLASSES}>
              {t("period3M")}
            </ToggleGroupItem>
            <ToggleGroupItem value="6" className={PERIOD_ITEM_CLASSES}>
              {t("period6M")}
            </ToggleGroupItem>
            <ToggleGroupItem value="12" className={PERIOD_ITEM_CLASSES}>
              {t("period1Y")}
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>
      {/* Chart area */}
      <div className="flex-1 overflow-hidden">
        <ChartContainer
          config={chartConfig}
          className="h-full w-full overflow-hidden"
        >
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="saasCostGradient" x1="0" y1="0" x2="0" y2="1">
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
            <CartesianGrid
              horizontal={true}
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="0"
            />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              tickFormatter={formatMonthShort}
              padding={{ left: 10, right: 10 }}
            />
            <YAxis hide={true} />
            <ChartTooltip
              content={(props) => (
                <ChartTooltipContent
                  active={props.active}
                  label={props.label}
                  payload={props.payload ?? []}
                  formatter={(value) => (
                    <div className="flex w-full items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        {chartConfig.saasCost.label}
                      </span>
                      <span className="font-mono font-medium tabular-nums">
                        {formatCurrency(Number(value))}
                      </span>
                    </div>
                  )}
                />
              )}
            />
            <Area
              type="monotone"
              dataKey="saasCost"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#saasCostGradient)"
              dot={false}
              activeDot={false}
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </Card>
  );
}
