// src/components/dashboard-v2-seat/department-spend-chart.tsx
"use client";

import type { DepartmentInsights } from "@/actions/department-insights";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_BASE_CURRENCY } from "@/lib/fx/convert";
import {
  formatMoney,
  formatMoneyCompact,
} from "@/lib/services/discovery/money";
import { Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { DashboardEmptyState } from "./dashboard-empty-state";

/** Donut colours: Materio chart tokens (primary, info, success, warning, error). */
const DONUT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const CARD_CLASSES = "h-[440px] gap-4 overflow-clip px-5";

interface DepartmentSpendChartProps {
  data: DepartmentInsights;
  isLoading?: boolean;
  /** Organisation base currency (department totals are already in it). */
  currency?: string;
}

/**
 * 부서별 지출 분석 차트 컴포넌트
 * - Figma 디자인 적용: 얇은 도넛 차트 + 테이블 레이아웃
 * - 중앙: "월간 총계 (₩)" + 금액
 * - 하단: 부서별 리스트 (색상 점 + 이름 + 인원수 + 퍼센트)
 */
export function DepartmentSpendChart({
  data,
  isLoading,
  currency = DEFAULT_BASE_CURRENCY,
}: DepartmentSpendChartProps) {
  const t = useTranslations("dashboardV2Seat.department");
  const locale = useLocale();

  // 비용 순 정렬, 상위 5개 부서
  const chartData = useMemo(() => {
    return [...data.departments]
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 5);
  }, [data.departments]);

  // 총 비용 계산
  const totalCost = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.totalCost, 0);
  }, [chartData]);

  // 퍼센트 계산
  const dataWithPercent = useMemo(() => {
    return chartData.map((item) => ({
      ...item,
      percentage:
        totalCost > 0 ? Math.round((item.totalCost / totalCost) * 100) : 0,
    }));
  }, [chartData, totalCost]);

  // 로딩 상태
  if (isLoading) {
    return (
      <Card className={CARD_CLASSES}>
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

  // 데이터 없음 상태
  if (chartData.length === 0) {
    return (
      <Card className={CARD_CLASSES}>
        <p
          className="text-foreground truncate text-lg font-medium"
          title={t("title")}
        >
          {t("title")}
        </p>
        <DashboardEmptyState icon={Users} message={t("noData")} />
      </Card>
    );
  }

  return (
    <Card className={CARD_CLASSES}>
      {/* 타이틀 */}
      <p
        className="text-foreground truncate text-lg font-medium"
        title={t("title")}
      >
        {t("title")}
      </p>

      {/* 콘텐츠 영역 */}
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {/* 도넛 차트 + 중앙 텍스트 */}
        <div className="relative flex h-[180px] shrink-0 items-center justify-center">
          <ResponsiveContainer width={180} height={180}>
            <PieChart>
              <Pie
                data={dataWithPercent}
                cx="50%"
                cy="50%"
                innerRadius="80%"
                outerRadius="90%"
                dataKey="totalCost"
                stroke="var(--card)"
                paddingAngle={2}
              >
                {dataWithPercent.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* 중앙 텍스트 */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <span className="text-muted-foreground max-w-[8.5rem] truncate text-xs">
              {t("monthlyTotal")}
            </span>
            <span
              className="text-foreground max-w-[8.5rem] truncate text-xl font-medium tabular-nums"
              title={formatMoney(totalCost, currency, locale)}
            >
              {formatMoneyCompact(totalCost, currency, locale)}
            </span>
          </div>
        </div>

        {/* 테이블 영역 */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {dataWithPercent.map((item, index) => (
            <div
              key={item.department}
              className="border-border flex min-w-0 items-center gap-2 border-t px-2 py-2"
            >
              {/* 부서 이름 + 색상 점 */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length],
                  }}
                />
                <span
                  className="text-foreground truncate text-[0.8125rem]"
                  title={item.department}
                >
                  {item.department}
                </span>
              </div>

              {/* 인원수 */}
              <div className="w-14 shrink-0 text-right">
                <span className="text-muted-foreground text-xs tabular-nums">
                  {item.headcount}
                  {t("countUnit")}
                </span>
              </div>

              {/* 퍼센트 */}
              <div className="w-12 shrink-0 text-right">
                <span className="text-foreground text-xs font-medium tabular-nums">
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
