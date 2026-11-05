// src/app/(dashboard)/reports/renewal/_components/renewal-day-panel.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useBaseCurrency } from "@/hooks/use-base-currency";
import { cn } from "@/lib/utils";
import type { UpcomingRenewal } from "@/types/dashboard";
import { Calendar, DollarSign } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

type UrgencyLevel = "urgent" | "warning" | "normal";

interface RenewalDayPanelProps {
  selectedDate: string | null;
  renewals: UpcomingRenewal[];
}

// 긴급도 계산
function getUrgencyLevel(daysUntilRenewal: number): UrgencyLevel {
  if (daysUntilRenewal <= 7) return "urgent";
  if (daysUntilRenewal <= 14) return "warning";
  return "normal";
}

// 긴급도별 스타일 (Tailwind 표준 색상)
const urgencyStyles = {
  urgent: {
    badge: "error" as const,
    bg: "",
    border: "border-error/40",
    icon: "text-error",
    iconBg: "tonal-error",
  },
  warning: {
    badge: "warning" as const,
    bg: "",
    border: "border-warning/40",
    icon: "text-warning",
    iconBg: "tonal-warning",
  },
  normal: {
    badge: "info" as const,
    bg: "",
    border: "",
    icon: "text-info",
    iconBg: "tonal-info",
  },
};

// 금액 포맷
function formatCurrency(
  amount: number,
  currency: string,
  locale: string = "ko"
): string {
  return new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// 날짜 포맷 (YYYY-MM-DD → 로케일)
function formatDateLocalized(dateStr: string, locale: string = "ko"): string {
  const [year, month, day] = dateStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return date.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// 총 금액 계산
function calculateTotalAmount(renewals: UpcomingRenewal[]): number {
  return renewals.reduce((sum, r) => sum + r.amount, 0);
}

export function RenewalDayPanel({
  selectedDate,
  renewals,
}: RenewalDayPanelProps) {
  const t = useTranslations("reports.renewal.dayPanel");
  const locale = useLocale();
  const { baseCurrency } = useBaseCurrency();

  // 선택된 날짜가 없는 경우
  if (!selectedDate) {
    return (
      <Card className="flex h-full flex-col">
        <CardHeader>
          <CardTitle className="flex min-w-0 items-center gap-3">
            <span className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md">
              <Calendar className="size-5" />
            </span>
            <span className="truncate">{t("title")}</span>
          </CardTitle>
          <CardDescription>{t("selectDate")}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="tonal-neutral flex size-10 items-center justify-center rounded-md">
              <Calendar className="size-5" />
            </div>
            <p className="text-muted-foreground text-[0.9375rem] whitespace-pre-line">
              {t("selectDateHint")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalAmount = calculateTotalAmount(renewals);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex min-w-0 items-center gap-2">
              <Calendar className="text-primary size-5 shrink-0" />
              <span className="truncate">
                {formatDateLocalized(selectedDate, locale)}
              </span>
            </CardTitle>
            <CardDescription>
              {renewals.length > 0
                ? t("renewalCount", { count: renewals.length })
                : t("noRenewal")}
            </CardDescription>
          </div>
          {renewals.length > 0 && (
            <div className="min-w-0 text-right">
              <p className="text-muted-foreground truncate text-[0.8125rem]">
                {t("totalCost")}
              </p>
              <p className="kpi-value">
                {formatCurrency(totalAmount, baseCurrency, locale)}
              </p>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {renewals.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-8 text-center">
            <div className="tonal-neutral flex size-10 items-center justify-center rounded-md">
              <Calendar className="size-5" />
            </div>
            <p className="text-muted-foreground">{t("emptyDate")}</p>
          </div>
        ) : (
          <div className="h-full space-y-3 overflow-y-auto">
            {renewals.map((renewal) => {
              const urgencyLevel = getUrgencyLevel(renewal.daysUntilRenewal);
              const styles = urgencyStyles[urgencyLevel];

              return (
                <div
                  key={renewal.id}
                  className={cn(
                    "flex min-w-0 items-center justify-between gap-3 rounded-md border p-3",
                    styles.border,
                    styles.bg
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-md",
                        styles.iconBg
                      )}
                    >
                      <DollarSign className={cn("size-5", styles.icon)} />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="truncate font-medium"
                        title={renewal.appName}
                      >
                        {renewal.appName}
                      </p>
                      <Badge
                        variant={styles.badge}
                        className="mt-1 tabular-nums"
                      >
                        D-{renewal.daysUntilRenewal}
                      </Badge>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-medium tabular-nums">
                      {formatCurrency(renewal.amount, renewal.currency, locale)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
