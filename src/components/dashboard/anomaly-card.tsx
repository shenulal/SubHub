"use client";

import { StatusBalloon } from "@/components/common";
import { Card } from "@/components/ui/card";
import type { AnomalyKpiData } from "@/types/dashboard";
import { useTranslations } from "next-intl";
import Link from "next/link";

interface AnomalyCardProps {
  data: AnomalyKpiData;
  isReadOnly?: boolean;
}

/**
 * AnomalyCard
 * Cost anomaly detection KPI card based on the Figma design
 * - Semi-transparent white background
 * - Shows a speech bubble when the value is 0
 * - Purple status area at the bottom
 */
export function AnomalyCard({ data, isReadOnly = false }: AnomalyCardProps) {
  const t = useTranslations("dashboardV3.kpi.anomaly");

  const statusText = data.count > 0 ? t("hasAnomalies") : t("noAnomalies");

  const cardContent = (
    <Card className="bg-card flex h-full flex-col gap-3 rounded border-none px-3 pt-5 pb-3 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)]">
      {/* Top: label + number */}
      <div className="flex flex-1 flex-col gap-2 px-2">
        <p className="text-primary text-xs">{t("title")}</p>
        <div className="flex items-center gap-1">
          <p className="text-secondary-foreground text-2xl font-medium">
            {data.count}
          </p>
          {/* Speech bubble when the value is 0 */}
          {data.count === 0 && <StatusBalloon variant="perfect" />}
        </div>
      </div>
      {/* Bottom: status */}
      <div className="bg-purple-gray rounded p-2">
        <p className="text-muted-foreground text-xs">{statusText}</p>
      </div>
    </Card>
  );

  if (isReadOnly) return cardContent;

  return (
    <Link
      href="/reports/cost"
      aria-label={t("ariaLabel")}
      className="block h-full"
    >
      <Card className="bg-card flex h-full cursor-pointer flex-col gap-3 rounded border-none px-3 pt-5 pb-3 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)] transition-all hover:shadow-md">
        {/* Top: label + number */}
        <div className="flex flex-1 flex-col gap-2 px-2">
          <p className="text-primary text-xs">{t("title")}</p>
          <div className="flex items-center gap-1">
            <p className="text-secondary-foreground text-2xl font-medium">
              {data.count}
            </p>
            {/* Speech bubble when the value is 0 */}
            {data.count === 0 && <StatusBalloon variant="perfect" />}
          </div>
        </div>
        {/* Bottom: status */}
        <div className="bg-purple-gray rounded p-2">
          <p className="text-muted-foreground text-xs">{statusText}</p>
        </div>
      </Card>
    </Link>
  );
}
