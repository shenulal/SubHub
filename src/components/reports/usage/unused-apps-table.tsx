// src/components/reports/usage/unused-apps-table.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DEFAULT_BASE_CURRENCY, formatMoney } from "@/lib/fx/convert";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

interface UnusedAppItem {
  appId: string;
  appName: string;
  lastUsedAt: string | null;
  licenseCount: number | null;
  monthlyWastedCost: number;
}

interface UnusedAppsTableProps {
  apps: UnusedAppItem[];
}

export function UnusedAppsTable({ apps }: UnusedAppsTableProps) {
  const t = useTranslations();
  const formatLastUsed = (dateStr: string | null): string => {
    if (!dateStr) return t("reports.usage.unusedApps.lastUsed.none");
    try {
      return format(parseISO(dateStr), "yyyy-MM-dd", { locale: ko });
    } catch {
      return dateStr;
    }
  };

  if (apps.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex min-w-0 items-center gap-3">
            <span className="tonal-warning flex size-10 shrink-0 items-center justify-center rounded-md">
              <AlertTriangle className="size-5" />
            </span>
            <span className="truncate">
              {t("reports.usage.unusedApps.title")}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <div className="tonal-neutral flex size-10 items-center justify-center rounded-md">
              <AlertTriangle className="size-5" />
            </div>
            <p className="text-muted-foreground text-[0.9375rem]">
              {t("reports.usage.unusedApps.empty")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 잠재적 비용 낭비 계산 (실제 구독 금액 기반 월간 비용)
  const estimatedWaste = apps.reduce(
    (sum, app) => sum + app.monthlyWastedCost,
    0
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex min-w-0 items-center gap-3">
            <span className="tonal-warning flex size-10 shrink-0 items-center justify-center rounded-md">
              <AlertTriangle className="size-5" />
            </span>
            <span className="truncate">
              {t("reports.usage.unusedApps.title")}
            </span>
          </CardTitle>
          {estimatedWaste > 0 && (
            <Badge variant="error" className="tabular-nums">
              {t("reports.usage.unusedApps.estimatedWaste", {
                amount: formatMoney(estimatedWaste, DEFAULT_BASE_CURRENCY),
              })}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {t("reports.usage.unusedApps.table.appName")}
                </TableHead>
                <TableHead>
                  {t("reports.usage.unusedApps.table.lastUsedAt")}
                </TableHead>
                <TableHead>
                  {t("reports.usage.unusedApps.table.licenseCount")}
                </TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.map((app) => (
                <TableRow
                  key={app.appId}
                  className="hover:bg-muted/60 transition-colors"
                >
                  <TableCell className="max-w-[18rem] font-medium">
                    <span className="block truncate" title={app.appName}>
                      {app.appName}
                    </span>
                  </TableCell>
                  <TableCell>{formatLastUsed(app.lastUsedAt)}</TableCell>
                  <TableCell>
                    {app.licenseCount !== null ? (
                      <Badge variant="secondary" className="tabular-nums">
                        {t("reports.usage.unusedApps.lastUsed.count", {
                          count: app.licenseCount,
                        })}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/apps/${app.appId}`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
