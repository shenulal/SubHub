"use client";

/**
 * Contract term card: start/end, auto-renewal, notice period and a live
 * countdown to the cancellation deadline with a "notice window open" state.
 */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getNoticeWindow,
  type NoticeWindowState,
} from "@/lib/services/subscription/contract-terms";
import { cn } from "@/lib/utils";
import {
  AlarmClock,
  CalendarRange,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { formatDate } from "./subscription-detail.utils";

interface SubscriptionContractCardProps {
  startDate: Date;
  endDate: Date | null;
  autoRenewal: boolean;
  noticePeriodDays: number | null;
  cancellationDeadline: Date | null;
  reminderLeadDays: number[];
  /** Days before the deadline during which the window counts as "open". */
  windowDays: number;
  now?: Date;
}

const TONE: Record<NoticeWindowState, string> = {
  no_deadline: "border-border bg-muted/40 text-muted-foreground",
  upcoming: "border-info/30 bg-info/10 text-foreground",
  window_open: "border-warning/40 bg-warning/10 text-foreground",
  deadline_passed: "border-error/40 bg-error/10 text-foreground",
};

export function SubscriptionContractCard({
  startDate,
  endDate,
  autoRenewal,
  noticePeriodDays,
  cancellationDeadline,
  reminderLeadDays,
  windowDays,
  now = new Date(),
}: SubscriptionContractCardProps) {
  const t = useTranslations("lifecycle.contract");
  const window = getNoticeWindow(cancellationDeadline, now, windowDays);
  const days = Math.abs(window.daysUntilDeadline ?? 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarRange className="text-muted-foreground h-4 w-4" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div
          className={cn(
            "flex items-start gap-3 rounded-md border px-4 py-3 text-sm",
            TONE[window.state]
          )}
          role={window.state === "window_open" ? "alert" : undefined}
        >
          {window.state === "window_open" ? (
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlarmClock className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div className="space-y-0.5">
            <p className="font-medium">
              {t(`countdown.${window.state}`, { days })}
            </p>
            {window.state === "window_open" && autoRenewal && (
              <p className="text-xs opacity-80">{t("windowOpenHint")}</p>
            )}
            {cancellationDeadline && (
              <p className="text-xs opacity-80">
                {t("deadline")}: {formatDate(cancellationDeadline)}
              </p>
            )}
          </div>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("start")}
            </dt>
            <dd className="mt-1 text-sm font-medium tabular-nums">
              {formatDate(startDate)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("end")}
            </dt>
            <dd className="mt-1 text-sm font-medium tabular-nums">
              {endDate ? formatDate(endDate) : t("noEnd")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("autoRenewal")}
            </dt>
            <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium">
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5",
                  autoRenewal ? "text-success" : "text-muted-foreground"
                )}
              />
              {autoRenewal ? t("on") : t("off")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("noticePeriod")}
            </dt>
            <dd className="mt-1 text-sm font-medium tabular-nums">
              {noticePeriodDays == null
                ? "-"
                : t("days", { count: noticePeriodDays })}
            </dd>
          </div>
        </dl>

        {reminderLeadDays.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-4 text-xs">
            <span className="text-muted-foreground font-medium">
              {t("reminders")}
            </span>
            {[...reminderLeadDays]
              .sort((a, b) => b - a)
              .map((lead) => (
                <span
                  key={lead}
                  className="bg-muted rounded-full px-2 py-0.5 tabular-nums"
                >
                  {t("reminderLead", { days: lead })}
                </span>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
