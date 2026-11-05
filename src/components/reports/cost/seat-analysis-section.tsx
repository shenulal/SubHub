// src/app/(dashboard)/reports/cost/_components/seat-analysis-section.tsx
"use client";

import { getSeatOptimizationSuggestions } from "@/actions/seat-optimization";
import { getSeatWasteAnalysis } from "@/actions/seat-waste-analysis";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DEFAULT_BASE_CURRENCY, formatMoney } from "@/lib/fx/convert";
import type {
  SeatOptimizationItem,
  SeatWasteAnalysis,
} from "@/types/seat-analytics";
import {
  AlertTriangle,
  Gauge,
  PiggyBank,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ReportStatCard } from "../report-stat-card";
import { SeatAnalysisSkeleton } from "./cost-report-skeleton";
import { SimulationDialog } from "./simulation-dialog";

function formatCurrency(value: number, currency = DEFAULT_BASE_CURRENCY) {
  return formatMoney(value, currency);
}

function getUtilizationBadge(rate: number) {
  if (rate < 50)
    return (
      <Badge variant="error" className="tabular-nums">
        {rate}%
      </Badge>
    );
  if (rate < 75)
    return (
      <Badge variant="warning" className="tabular-nums">
        {rate}%
      </Badge>
    );
  return (
    <Badge variant="success" className="tabular-nums">
      {rate}%
    </Badge>
  );
}

export function SeatAnalysisSection() {
  const t = useTranslations("reports.cost.seatAnalysis");
  const [wasteData, setWasteData] = useState<SeatWasteAnalysis | null>(null);
  const [optimizationItems, setOptimizationItems] = useState<
    SeatOptimizationItem[]
  >([]);
  const [totalMonthlySavings, setTotalMonthlySavings] = useState(0);
  const [totalAnnualSavings, setTotalAnnualSavings] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<SeatOptimizationItem | null>(
    null
  );

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const [wasteResult, optimizationResult] = await Promise.all([
        getSeatWasteAnalysis(),
        getSeatOptimizationSuggestions(),
      ]);
      if (wasteResult.success && wasteResult.data) {
        setWasteData(wasteResult.data);
      }
      if (optimizationResult.success && optimizationResult.data) {
        setOptimizationItems(optimizationResult.data.items);
        setTotalMonthlySavings(optimizationResult.data.totalMonthlySavings);
        setTotalAnnualSavings(optimizationResult.data.totalAnnualSavings);
      }
      setIsLoading(false);
    };
    load();
  }, []);

  if (isLoading) {
    return <SeatAnalysisSkeleton />;
  }

  const hasWasteData = wasteData && wasteData.apps.length > 0;
  const hasOptimizationData = optimizationItems.length > 0;

  if (!hasWasteData && !hasOptimizationData) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <div className="tonal-neutral flex size-10 items-center justify-center rounded-md">
            <TrendingDown className="size-5" />
          </div>
          <p className="text-muted-foreground">{t("noData")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Seat 낭비 분석 (D-2) */}
      {hasWasteData && (
        <>
          <Separator />
          <div className="min-w-0">
            <h2 className="text-xl font-medium">{t("wasteTitle")}</h2>
            <p className="text-muted-foreground text-[0.9375rem]">
              {t("wasteDescription")}
            </p>
          </div>

          {/* KPI Cards */}
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            <ReportStatCard
              icon={TrendingDown}
              tone="error"
              toneValue
              title={t("monthlyWaste")}
              value={formatCurrency(wasteData.summary.totalMonthlyWaste)}
            />
            <ReportStatCard
              icon={AlertTriangle}
              tone="warning"
              toneValue
              title={t("annualWaste")}
              value={formatCurrency(wasteData.summary.totalAnnualWaste)}
            />
            <ReportStatCard
              icon={Gauge}
              tone="primary"
              title={t("overallUtilization")}
              value={`${wasteData.summary.overallUtilizationRate}%`}
            >
              <Progress
                value={wasteData.summary.overallUtilizationRate}
                className="mt-1 h-2"
              />
            </ReportStatCard>
          </div>

          {/* App-level detail table */}
          <Card className="min-h-[450px]">
            <CardHeader>
              <CardTitle>{t("appWasteTable")}</CardTitle>
              <CardDescription>
                {t("appWasteCount", { count: wasteData.summary.appCount })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("colApp")}</TableHead>
                      <TableHead className="text-right">
                        {t("colTotalSeats")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("colAssigned")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("colActive")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("colWasted")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("colMonthlyWaste")}
                      </TableHead>
                      <TableHead>{t("colUtilization")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wasteData.apps.map((app) => (
                      <TableRow
                        key={app.appId}
                        className="hover:bg-muted/60 transition-colors"
                      >
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-2">
                            {app.appLogoUrl ? (
                              <Image
                                src={app.appLogoUrl}
                                alt={app.appName}
                                width={24}
                                height={24}
                                className="rounded"
                              />
                            ) : (
                              <div className="tonal-primary flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-medium">
                                {app.appName.charAt(0)}
                              </div>
                            )}
                            <span
                              className="max-w-[16rem] truncate font-medium"
                              title={app.appName}
                            >
                              {app.appName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {app.totalSeats}
                        </TableCell>
                        <TableCell className="text-right">
                          {app.assignedSeats}
                        </TableCell>
                        <TableCell className="text-right">
                          {app.activeSeats}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-error">{app.wastedSeats}</span>
                        </TableCell>
                        <TableCell className="text-error text-right font-medium">
                          {formatCurrency(app.monthlyWaste)}
                        </TableCell>
                        <TableCell>
                          {getUtilizationBadge(app.utilizationRate)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Seat 최적화 제안 (D-4) */}
      {hasOptimizationData && (
        <>
          <Separator />
          <div className="min-w-0">
            <h2 className="text-xl font-medium">{t("optimizationTitle")}</h2>
            <p className="text-muted-foreground text-[0.9375rem]">
              {t("optimizationDescription")}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            <ReportStatCard
              icon={Wallet}
              tone="success"
              toneValue
              title={t("monthlySavings")}
              value={formatCurrency(totalMonthlySavings)}
            />
            <ReportStatCard
              icon={PiggyBank}
              tone="success"
              toneValue
              title={t("annualSavings")}
              value={formatCurrency(totalAnnualSavings)}
            />
            <ReportStatCard
              icon={TrendingDown}
              tone="primary"
              title={t("optimizableApps")}
              value={t("optimizableAppsCount", {
                count: optimizationItems.length,
              })}
            />
          </div>

          <Card className="min-h-[450px]">
            <CardHeader>
              <CardTitle>{t("optimizationTitle")}</CardTitle>
              <CardDescription>{t("optimizationDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("colApp")}</TableHead>
                      <TableHead className="text-right">
                        {t("colCurrentSeats")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("colActiveUsers")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("colRecommended")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("colExcess")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("colMonthlySaving")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("colAnnualSaving")}
                      </TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {optimizationItems.map((item) => (
                      <TableRow
                        key={item.subscriptionId}
                        className="hover:bg-muted/60 transition-colors"
                      >
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-2">
                            {item.appLogoUrl ? (
                              <Image
                                src={item.appLogoUrl}
                                alt={item.appName}
                                width={24}
                                height={24}
                                className="rounded"
                              />
                            ) : (
                              <div className="tonal-primary flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-medium">
                                {item.appName.charAt(0)}
                              </div>
                            )}
                            <span
                              className="max-w-[16rem] truncate font-medium"
                              title={item.appName}
                            >
                              {item.appName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.currentSeats}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.activeUsers}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="info" className="tabular-nums">
                            {item.recommendedSeats}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="error" className="tabular-nums">
                            {item.excessSeats}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-success text-right font-medium">
                          {formatCurrency(item.monthlySavings)}
                        </TableCell>
                        <TableCell className="text-success text-right text-sm">
                          {formatCurrency(item.annualSavings)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedItem(item)}
                          >
                            <TrendingDown className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {selectedItem && (
            <SimulationDialog
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
