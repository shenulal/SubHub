"use client";

import { Card } from "@/components/ui/card";
import { useBaseCurrency } from "@/hooks/use-base-currency";
import { formatMoney } from "@/lib/fx/convert";
import type { TotalCostKpiData } from "@/types/dashboard";
import { useTranslations } from "next-intl";
import Link from "next/link";

interface TotalCostCardProps {
  data: TotalCostKpiData;
  isReadOnly?: boolean;
}

/**
 * formatCurrency
 * Formats an amount in the given currency
 */
function formatCurrency(amount: number, currency: string): string {
  return formatMoney(amount, currency, "en", 0);
}

/**
 * TotalCostCard
 * Total cost KPI card based on the Figma design
 * - Semi-transparent white background
 * - Purple month-over-month area at the bottom
 */
export function TotalCostCard({
  data,
  isReadOnly = false,
}: TotalCostCardProps) {
  const t = useTranslations("dashboardV3.kpi.totalCost");
  const { baseCurrency } = useBaseCurrency();

  const trendText =
    data.changePercent !== 0
      ? `${t("vsLastMonth")} ${Math.abs(data.changePercent)}% ${data.changePercent > 0 ? "up" : "down"}`
      : null;

  const cardContent = (
    <Card className="bg-card flex h-full flex-col gap-3 rounded border-none px-3 pt-5 pb-3 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)]">
      {/* Top: label + amount */}
      <div className="flex flex-1 flex-col gap-2 px-2">
        <p className="text-primary text-xs">{t("title")}</p>
        <div className="flex items-center gap-1">
          <p className="text-secondary-foreground text-2xl font-medium">
            {formatCurrency(data.amount, baseCurrency)}
          </p>
        </div>
      </div>
      {/* Bottom: vs last month */}
      {trendText && (
        <div className="bg-purple-gray rounded p-2">
          <p className="text-muted-foreground text-xs">{trendText}</p>
        </div>
      )}
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
        {/* Top: label + amount */}
        <div className="flex flex-1 flex-col gap-2 px-2">
          <p className="text-primary text-xs">{t("title")}</p>
          <div className="flex items-center gap-1">
            <p className="text-secondary-foreground text-2xl font-medium">
              {formatCurrency(data.amount, baseCurrency)}
            </p>
          </div>
        </div>
        {/* Bottom: vs last month */}
        {trendText && (
          <div className="bg-purple-gray rounded p-2">
            <p className="text-muted-foreground text-xs">{trendText}</p>
          </div>
        )}
      </Card>
    </Link>
  );
}
