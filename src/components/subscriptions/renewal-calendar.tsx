// src/components/subscriptions/renewal-calendar.tsx
"use client";

/**
 * Month grid for renewals (9.4) with distinct markers for trial endings and
 * cancellation deadlines. Marker colours are semantic and theme-safe.
 */
import type { CalendarData } from "@/actions/subscriptions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CalendarMarker, CalendarMarkerKind } from "@/types/discovery";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

interface RenewalCalendarProps {
  calendarData: CalendarData;
  markers?: Record<string, CalendarMarker[]>;
  onMonthChange: (year: number, month: number) => void;
  onDateSelect: (date: string) => void;
  selectedDate?: string | null;
}

export const MARKER_STYLES: Record<
  CalendarMarkerKind,
  { dot: string; label: string }
> = {
  trialEnd: { dot: "bg-info", label: "text-info" },
  cancellationDeadline: { dot: "bg-warning", label: "text-warning" },
};

const GRID_CELLS = 42;

function buildGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = Array.from({ length: firstDay }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length < GRID_CELLS) cells.push(null);
  return cells;
}

export function RenewalCalendar({
  calendarData,
  markers = {},
  onMonthChange,
  onDateSelect,
  selectedDate,
}: RenewalCalendarProps) {
  const t = useTranslations();
  const td = useTranslations("discovery.calendar");
  const { year, month, renewals } = calendarData;

  const weekdays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) =>
    t(`subscriptions.calendar.weekdays.${d}`)
  );
  const monthName = t(`subscriptions.calendar.months.${month}`);
  const cells = buildGrid(year, month);

  const dateKey = (day: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === year &&
    today.getMonth() + 1 === month &&
    today.getDate() === day;

  const prev = () =>
    month === 1 ? onMonthChange(year - 1, 12) : onMonthChange(year, month - 1);
  const next = () =>
    month === 12 ? onMonthChange(year + 1, 1) : onMonthChange(year, month + 1);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex min-w-0 items-center gap-3">
            <span className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md">
              <CalendarDays className="size-5" />
            </span>
            <span className="truncate">
              {t("subscriptions.calendar.title")}
            </span>
          </CardTitle>
          <div className="flex max-w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
            <ul
              className="text-muted-foreground hidden flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] sm:flex"
              aria-label={td("legend")}
            >
              <li className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="bg-primary size-2.5 rounded-full" />
                {td("renewal")}
              </li>
              {(Object.keys(MARKER_STYLES) as CalendarMarkerKind[]).map(
                (kind) => (
                  <li
                    key={kind}
                    className="flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <span
                      className={cn(
                        "size-2.5 rounded-full",
                        MARKER_STYLES[kind].dot
                      )}
                    />
                    {td(`markers.${kind}`)}
                  </li>
                )
              )}
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 whitespace-nowrap"
              onClick={() =>
                onMonthChange(today.getFullYear(), today.getMonth() + 1)
              }
            >
              {t("subscriptions.calendar.today")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-primary shrink-0 whitespace-nowrap"
            onClick={prev}
          >
            <ChevronLeft className="size-4" />
            {t("subscriptions.calendar.prev")}
          </Button>
          <h2 className="text-foreground min-w-0 truncate text-center text-lg font-medium">
            {t("subscriptions.calendar.monthYear", { year, month: monthName })}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-primary shrink-0 whitespace-nowrap"
            onClick={next}
          >
            {t("subscriptions.calendar.next")}
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1.5">
          {weekdays.map((day, index) => (
            <div
              key={day}
              className={cn(
                "text-muted-foreground truncate py-2 text-center text-xs font-medium tracking-wide uppercase",
                index === 0 && "text-error",
                index === 6 && "text-primary"
              )}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((day, index) => {
            if (day === null)
              return (
                <div
                  key={`empty-${index}`}
                  className="bg-muted/40 h-20 rounded-md sm:h-24"
                />
              );
            const key = dateKey(day);
            const renewalCount = renewals[key]?.length ?? 0;
            const dayMarkers = markers[key] ?? [];
            const hasAny = renewalCount > 0 || dayMarkers.length > 0;
            const dow = index % 7;
            return (
              <button
                key={key}
                type="button"
                data-testid={`day-${day}`}
                onClick={() => onDateSelect(key)}
                className={cn(
                  "hover:bg-muted border-border relative flex h-20 min-w-0 flex-col items-start overflow-hidden rounded-md border p-1.5 text-left transition-colors sm:h-24 sm:p-2",
                  isToday(day) && "border-primary bg-primary/5",
                  key === selectedDate && "ring-primary ring-2",
                  hasAny && "hover:border-primary/50 cursor-pointer",
                  dow === 0 && "text-error",
                  dow === 6 && "text-primary"
                )}
              >
                <span
                  className={cn(
                    "text-[0.9375rem] leading-none font-medium tabular-nums",
                    isToday(day) &&
                      "bg-primary text-primary-foreground inline-flex size-6 items-center justify-center rounded-full text-[0.8125rem]"
                  )}
                >
                  {day}
                </span>
                {renewalCount > 0 && (
                  <span
                    aria-hidden
                    className="bg-primary absolute right-2 bottom-2 size-2 rounded-full sm:hidden"
                  />
                )}
                {renewalCount > 0 && (
                  <Badge
                    data-testid="renewal-badge"
                    variant="primary"
                    className="absolute right-1.5 bottom-1.5 hidden max-w-[calc(100%-0.75rem)] truncate px-2 text-[0.6875rem] sm:inline-flex md:max-w-[calc(100%-3rem)]"
                  >
                    {t("subscriptions.calendar.renewalCount", {
                      count: renewalCount,
                    })}
                  </Badge>
                )}
                {dayMarkers.length > 0 && (
                  <span
                    className="absolute bottom-2 left-2 flex gap-1"
                    data-testid="calendar-markers"
                  >
                    {dayMarkers.slice(0, 4).map((m) => (
                      <span
                        key={`${m.kind}-${m.subscriptionId}`}
                        title={`${td(`markers.${m.kind}`)}: ${m.appName}`}
                        className={cn(
                          "h-2 w-2 rounded-full",
                          MARKER_STYLES[m.kind].dot
                        )}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
