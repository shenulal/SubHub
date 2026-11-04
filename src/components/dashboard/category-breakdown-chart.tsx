// src/components/dashboard/category-breakdown-chart.tsx
"use client";

/**
 * Category breakdown (4.2): donut by parent category with drill-down to
 * subcategories, owner/team filter and CSV export. Colours come from the
 * category master (falls back to chart tokens) so both themes stay intentional.
 */
import { getCategorySpendForDashboard } from "@/actions/discovery/dashboard-overview";
import { exportCategorySpendCsv } from "@/actions/discovery/export";
import { Can } from "@/components/common/can";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/services/discovery/money";
import { downloadCSV } from "@/lib/services/export/csv";
import { cn } from "@/lib/utils";
import type { CategorySpendSlice, NamedOption } from "@/types/discovery";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Download } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";

const TOKEN_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--magenta-primary)",
];
const ANY = "__any";
const MAX_LEGEND = 8;

interface CategoryBreakdownChartProps {
  initialData: CategorySpendSlice[];
  baseCurrency: string;
  owners: NamedOption[];
  teams: NamedOption[];
  /** Personal mode hides the owner/team filter. */
  showFilters: boolean;
}

function sliceColor(slice: CategorySpendSlice, index: number): string {
  return slice.color ?? TOKEN_COLORS[index % TOKEN_COLORS.length];
}

export function CategoryBreakdownChart({
  initialData,
  baseCurrency,
  owners,
  teams,
  showFilters,
}: CategoryBreakdownChartProps) {
  const t = useTranslations("discovery.dashboard.categories");
  const locale = useLocale();
  const [ownerId, setOwnerId] = useState<string | undefined>();
  const [teamId, setTeamId] = useState<string | undefined>();
  const [drill, setDrill] = useState<CategorySpendSlice | null>(null);
  const [isExporting, startExport] = useTransition();

  const isDefaultFilter = !ownerId && !teamId;
  const query = useQuery({
    queryKey: ["discovery", "category-spend", ownerId ?? null, teamId ?? null],
    queryFn: async () => {
      const result = await getCategorySpendForDashboard({ ownerId, teamId });
      if (!result.success || !result.data)
        throw new Error(result.error ?? "failed");
      return result.data;
    },
    initialData: isDefaultFilter ? initialData : undefined,
    enabled: !isDefaultFilter || initialData.length === 0,
  });

  const slices = useMemo<CategorySpendSlice[]>(() => {
    const source = query.data ?? initialData;
    return drill ? (drill.children ?? []) : source;
  }, [query.data, initialData, drill]);
  const total = slices.reduce((sum, s) => sum + s.monthlyBase, 0);
  const legend = slices.slice(0, MAX_LEGEND);

  const exportCsv = () =>
    startExport(async () => {
      const result = await exportCategorySpendCsv({ ownerId, teamId });
      if (result.success && result.data) {
        downloadCSV(result.data.csv, result.data.filename);
        toast.success(t("exported"));
      } else {
        toast.error(result.error ?? t("exportFailed"));
      }
    });

  return (
    <Card
      className="bg-card flex h-[450px] flex-col gap-4 overflow-clip rounded-xl border p-5 shadow-xs"
      data-testid="category-breakdown"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {drill && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setDrill(null)}
              aria-label={t("back")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <p className="text-foreground text-base font-semibold">
            {drill ? drill.name : t("title")}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {showFilters && (
            <>
              <Select
                value={ownerId ?? ANY}
                onValueChange={(v) => {
                  setOwnerId(v === ANY ? undefined : v);
                  setDrill(null);
                }}
              >
                <SelectTrigger
                  className="h-7 w-32 text-xs"
                  aria-label={t("owner")}
                >
                  <SelectValue placeholder={t("owner")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>{t("allOwners")}</SelectItem>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={teamId ?? ANY}
                onValueChange={(v) => {
                  setTeamId(v === ANY ? undefined : v);
                  setDrill(null);
                }}
              >
                <SelectTrigger
                  className="h-7 w-32 text-xs"
                  aria-label={t("team")}
                >
                  <SelectValue placeholder={t("team")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>{t("allTeams")}</SelectItem>
                  {teams.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <Can permission="reports:export">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={exportCsv}
              disabled={isExporting}
              aria-label={t("export")}
            >
              <Download className="h-4 w-4" />
            </Button>
          </Can>
        </div>
      </div>

      {query.isLoading ? (
        <div className="flex flex-1 flex-col items-center gap-4">
          <Skeleton className="h-[180px] w-[180px] rounded-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : slices.length === 0 ? (
        <p className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="relative flex h-[180px] shrink-0 items-center justify-center">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="monthlyBase"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={86}
                  paddingAngle={2}
                  stroke="var(--card)"
                  onClick={(_, index) => {
                    const target = slices[index];
                    if (!drill && target?.children?.length) setDrill(target);
                  }}
                  className={cn(!drill && "cursor-pointer")}
                >
                  {slices.map((s, i) => (
                    <Cell
                      key={s.categoryId ?? `u-${i}`}
                      fill={sliceColor(s, i)}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) =>
                    formatMoney(Number(value), baseCurrency, locale)
                  }
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
              <span className="text-muted-foreground text-[11px]">
                {t("perMonth")}
              </span>
              <span className="text-foreground text-base font-semibold tabular-nums">
                {formatMoney(total, baseCurrency, locale)}
              </span>
            </div>
          </div>
          <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {legend.map((s, i) => {
              const pct =
                total > 0 ? Math.round((s.monthlyBase / total) * 100) : 0;
              const drillable = !drill && Boolean(s.children?.length);
              return (
                <li key={s.categoryId ?? `u-${i}`}>
                  <button
                    type="button"
                    disabled={!drillable}
                    onClick={() => drillable && setDrill(s)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm",
                      drillable && "hover:bg-muted cursor-pointer"
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: sliceColor(s, i) }}
                    />
                    <span className="truncate">
                      {s.name === "__uncategorised"
                        ? t("uncategorised")
                        : s.name}
                    </span>
                    <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                      {s.count}
                    </span>
                    <span className="w-20 text-right text-xs tabular-nums">
                      {formatMoney(s.monthlyBase, baseCurrency, locale)}
                    </span>
                    <span className="text-muted-foreground w-9 text-right text-xs tabular-nums">
                      {pct}%
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
