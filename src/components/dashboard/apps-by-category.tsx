// src/components/dashboard/apps-by-category.tsx
"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategoryDistribution } from "@/types/dashboard";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

/**
 * Donut chart colours per the Figma design
 * - Same values as the globals.css variables
 * - Development: purple-primary (#6474F3)
 * - Design: magenta-primary (#D165D3)
 * - Collaboration: Yellow (#F5D063)
 * - Other: Orange (#F7A362)
 * - Data analytics: Gray (#D4D4D8)
 */
const DONUT_COLORS = [
  "#6474F3", // Development (purple-primary)
  "#D165D3", // Design (magenta-primary)
  "#F5D063", // Collaboration
  "#F7A362", // Other
  "#D4D4D8", // Data analytics
];

interface AppsByCategoryProps {
  data: CategoryDistribution[];
  isLoading?: boolean;
}

/**
 * Apps-by-category distribution chart
 * - Figma design: thin donut chart + table layout
 * - Centre: "Total Apps" + total count
 * - Bottom: per-category list (colour dot + name + count + percentage)
 */
export function AppsByCategory({ data, isLoading }: AppsByCategoryProps) {
  const t = useTranslations("dashboard.appsByCategory");

  // Show only the top 5 categories
  const chartData = useMemo(() => {
    return [...data].slice(0, 5);
  }, [data]);

  // Compute total app count
  const totalApps = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.count, 0);
  }, [chartData]);

  // Loading state
  if (isLoading) {
    return (
      <Card className="h-[440px] gap-4 px-5">
        <Skeleton className="h-6 w-32" />
        <div className="flex h-[180px] shrink-0 items-center justify-center">
          <Skeleton className="h-[180px] w-[180px] rounded-full" />
        </div>
        <div className="flex flex-col gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-[440px] gap-4 overflow-clip px-5">
      {/* Title */}
      <p className="text-foreground text-base font-semibold">{t("title")}</p>

      {/* Content area */}
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {/* Donut chart + centre text */}
        <div className="relative flex h-[180px] shrink-0 items-center justify-center">
          <ResponsiveContainer width={180} height={180}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius="80%"
                outerRadius="90%"
                dataKey="count"
                stroke="none"
                paddingAngle={2}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Centre text */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-muted-foreground text-xs">
              {t("totalApps")}
            </span>
            <span className="text-muted-foreground text-3xl font-semibold">
              {totalApps}
            </span>
          </div>
        </div>

        {/* Table area */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          {chartData.map((item, index) => (
            <div
              key={item.category}
              className="border-border flex items-center border-t px-2 py-1.5"
            >
              {/* Category name + colour dot */}
              <div className="flex flex-1 items-center gap-1">
                <div
                  className="h-[10px] w-[10px] shrink-0 rounded-full"
                  style={{
                    backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length],
                  }}
                />
                <span className="text-muted-foreground text-xs">
                  {item.category}
                </span>
              </div>

              {/* Count */}
              <div className="w-[60px] text-right">
                <span className="text-muted-foreground text-xs">
                  {item.count}
                  {t("countUnit")}
                </span>
              </div>

              {/* Percentage */}
              <div className="w-[60px] text-right">
                <span className="text-muted-foreground text-xs">
                  {item.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
