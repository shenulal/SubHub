"use client";

import { getTopCostApps } from "@/actions/cost-analytics";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DEFAULT_BASE_CURRENCY, formatMoney } from "@/lib/fx/convert";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { DashboardEmptyState } from "./dashboard-empty-state";

export interface CostAppData {
  id: string;
  name: string;
  logoUrl?: string;
  monthlyCost: number;
  usedLicenses: number;
  totalLicenses: number;
  usageEfficiency: number;
  grade: "A" | "B" | "C" | "D";
  hasSeatData: boolean;
}

interface CostAppsTableProps {
  initialData: CostAppData[];
  period: string;
  onPeriodChange: (period: string) => void;
  className?: string;
  /** Organisation base currency (costs are already in it). */
  currency?: string;
}

/** Shared Materio segmented-control item style (one line, fixed width). */
const PERIOD_ITEM_CLASSES =
  "text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-primary h-7 w-12 shrink-0 rounded-sm px-3 text-xs whitespace-nowrap data-[state=on]:font-medium data-[state=on]:shadow-xs";

const HEAD_CLASSES =
  "text-muted-foreground h-10 bg-transparent px-2 text-xs font-medium";

function getGradeColor(grade: string) {
  switch (grade) {
    case "A":
      return "tonal-success";
    case "B":
      return "tonal-info";
    case "C":
      return "tonal-warning";
    case "D":
      return "tonal-error";
    default:
      return "tonal-neutral";
  }
}

function getAppInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

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

function periodToDateRange(period: string): {
  startDate: Date;
  endDate: Date;
} {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - parseInt(period));
  return { startDate, endDate };
}

// Rank badge component
function RankBadge({ rank }: { rank: number }) {
  const isFirst = rank === 1;
  return (
    <div
      className={cn(
        "flex size-6 items-center justify-center rounded-sm text-xs font-medium tabular-nums",
        isFirst ? "bg-primary text-primary-foreground" : "tonal-primary"
      )}
    >
      {rank}
    </div>
  );
}

// Utilisation bar component
function UsageBars({ efficiency }: { efficiency: number }) {
  const filledBars = Math.ceil(efficiency / 20);
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-9 text-right text-sm tabular-nums">{efficiency}%</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={cn(
              "h-3 w-1 rounded-sm",
              i <= filledBars ? "bg-primary" : "bg-primary/20"
            )}
          />
        ))}
      </div>
    </div>
  );
}

export function CostAppsTable({
  initialData,
  period,
  onPeriodChange,
  className,
  currency = DEFAULT_BASE_CURRENCY,
}: CostAppsTableProps) {
  const t = useTranslations("dashboardV2Cost.table");
  const tChart = useTranslations("dashboardV2Cost.chart");
  const tEmpty = useTranslations("dashboardV2Seat.department");
  const locale = useLocale();
  const [data, setData] = useState<CostAppData[]>(initialData);
  const [isPending, startTransition] = useTransition();
  const isInitialMount = useRef(true);

  const fetchData = useCallback(
    (p: string) => {
      const { startDate, endDate } = periodToDateRange(p);
      startTransition(async () => {
        const res = await getTopCostApps({ limit: 10, startDate, endDate });
        if (res.success && res.data?.apps) {
          setData(
            res.data.apps.map((app) => ({
              id: app.appId,
              name: app.appName,
              logoUrl: app.appLogoUrl,
              monthlyCost: app.totalCost,
              usedLicenses: 0,
              totalLicenses: 0,
              usageEfficiency: 0,
              grade: "D" as const,
              hasSeatData: false,
            }))
          );
        }
      });
    },
    [startTransition]
  );

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetchData(period);
  }, [period, fetchData]);

  const filteredData = data.slice(0, 10);

  return (
    <Card className={cn("h-[400px] gap-4 px-5", className)}>
      {/* Header: title + period tabs */}
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p
          className="text-foreground min-w-0 truncate text-lg font-medium"
          title={t("title")}
        >
          {t("title")}
        </p>
        <ToggleGroup
          type="single"
          value={period}
          onValueChange={(value) => value && onPeriodChange(value)}
          className="bg-muted shrink-0 gap-0 rounded-md p-[3px]"
        >
          <ToggleGroupItem value="3" className={PERIOD_ITEM_CLASSES}>
            {tChart("period3M")}
          </ToggleGroupItem>
          <ToggleGroupItem value="6" className={PERIOD_ITEM_CLASSES}>
            {tChart("period6M")}
          </ToggleGroupItem>
          <ToggleGroupItem value="12" className={PERIOD_ITEM_CLASSES}>
            {tChart("period1Y")}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Table area */}
      {filteredData.length === 0 ? (
        <DashboardEmptyState icon={Trophy} message={tEmpty("noData")} />
      ) : (
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto transition-opacity [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            isPending && "opacity-50"
          )}
        >
          <Table>
            <TableHeader>
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className={cn(HEAD_CLASSES, "w-12 text-center")}>
                  {t("rank")}
                </TableHead>
                <TableHead className={HEAD_CLASSES}>{t("appName")}</TableHead>
                <TableHead className={HEAD_CLASSES}>
                  {t("monthlyCost")}
                </TableHead>
                <TableHead className={HEAD_CLASSES}>{t("licenses")}</TableHead>
                <TableHead className={HEAD_CLASSES}>
                  {t("usageEfficiency")}
                </TableHead>
                <TableHead className={cn(HEAD_CLASSES, "text-center")}>
                  {t("grade")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((app, index) => {
                const rank = index + 1;
                return (
                  <TableRow
                    key={app.id}
                    className="hover:bg-muted h-[52px] border-none transition-colors"
                  >
                    <TableCell className="px-2 py-2 text-center">
                      <div className="flex justify-center">
                        <RankBadge rank={rank} />
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="size-8 shrink-0 rounded-md">
                          {app.logoUrl ? (
                            <AvatarImage src={app.logoUrl} alt={app.name} />
                          ) : null}
                          <AvatarFallback className="rounded-md bg-transparent text-sm font-medium">
                            <span
                              className={cn(
                                "flex size-full items-center justify-center rounded-md",
                                getAppColor(app.name)
                              )}
                            >
                              {getAppInitial(app.name)}
                            </span>
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className="text-foreground max-w-[11rem] truncate text-sm font-medium"
                          title={app.name}
                        >
                          {app.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground px-2 py-2 text-sm font-medium tabular-nums">
                      {formatMoney(app.monthlyCost, currency, locale)}
                    </TableCell>
                    <TableCell className="text-muted-foreground px-2 py-2 text-sm tabular-nums">
                      {app.hasSeatData ? (
                        `${app.usedLicenses} / ${app.totalLicenses}`
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      {app.hasSeatData ? (
                        <UsageBars efficiency={app.usageEfficiency} />
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="px-2 py-2 text-center">
                      {app.hasSeatData ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            getGradeColor(app.grade),
                            "border-transparent text-xs font-medium"
                          )}
                        >
                          {app.grade}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
