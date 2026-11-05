"use client";

/**
 * Unacknowledged price-change events. Mounted on the subscription detail page
 * (banner mode, one subscription) and on the dashboard (list mode).
 */
import {
  acknowledgePriceChange,
  listPriceChanges,
  type PriceChangeItem,
} from "@/actions/subscriptions";
import { Can } from "@/components/common/can";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "./subscription-detail.utils";

interface PriceChangeAlertsProps {
  /** Restrict to one subscription (detail page banner). */
  subscriptionId?: string;
  limit?: number;
  className?: string;
  /** Show a link to the subscription (dashboard list). */
  showSubscriptionLink?: boolean;
}

function formatPercent(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function PriceChangeAlerts({
  subscriptionId,
  limit,
  className,
  showSubscriptionLink = false,
}: PriceChangeAlertsProps) {
  const t = useTranslations("lifecycle.priceChanges");
  const [items, setItems] = useState<PriceChangeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await listPriceChanges({ subscriptionId, limit });
    if (result.success && result.data) setItems(result.data);
    setIsLoading(false);
  }, [subscriptionId, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  const acknowledge = async (
    item: PriceChangeItem,
    applyNewAmount: boolean
  ) => {
    setBusyId(item.id);
    const result = await acknowledgePriceChange(item.id, { applyNewAmount });
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error ?? t("acknowledge"));
      return;
    }
    toast.success(applyNewAmount ? t("applied") : t("acknowledged"));
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  if (isLoading) {
    return subscriptionId ? null : (
      <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
    );
  }
  if (items.length === 0) {
    return subscriptionId ? null : (
      <p className={cn("text-muted-foreground text-sm", className)}>
        {t("empty")}
      </p>
    );
  }

  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((item) => {
        const up = item.changePercent > 0;
        const Icon = up ? TrendingUp : TrendingDown;
        return (
          <li
            key={item.id}
            role="alert"
            className={cn(
              "flex flex-col gap-3 rounded-md border px-4 py-3 text-sm sm:flex-row sm:items-center",
              up
                ? "border-warning/40 bg-warning/10 text-foreground"
                : "border-success/40 bg-success/10 text-foreground"
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="font-medium">{t("bannerTitle")}</p>
              <p>
                {t("banner", {
                  name: item.appName,
                  newAmount: formatCurrency(item.newAmount, item.currency),
                  previousAmount: formatCurrency(
                    item.previousAmount,
                    item.currency
                  ),
                  percent: formatPercent(item.changePercent),
                })}
              </p>
              <p className="text-xs opacity-75">
                {t("detectedOn", {
                  date: formatDate(item.detectedAt),
                  source: t(`sources.${item.source}`),
                })}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {showSubscriptionLink && (
                <Button variant="link" size="sm" asChild className="h-auto p-0">
                  <Link href={`/subscriptions/${item.subscriptionId}`}>
                    {t("viewSubscription")}
                  </Link>
                </Button>
              )}
              <Can permission="subscriptions:update">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === item.id}
                  onClick={() => void acknowledge(item, false)}
                >
                  {t("acknowledge")}
                </Button>
                <Button
                  size="sm"
                  disabled={busyId === item.id}
                  onClick={() => void acknowledge(item, true)}
                >
                  {busyId === item.id && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("applyNewAmount")}
                </Button>
              </Can>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
