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
  trialEnd: {
    dot: "bg-violet-500",
    label: "text-violet-600 dark:text-violet-400",
  },
  cancellationDeadline: {
    dot: "bg-orange-500",
    label: "text-orange-600 dark:text-orange-400",
  },
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
    <Card className="border-border/50 rounded-sm shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            {t("subscriptions.calendar.title")}
          </CardTitle>
          <div className="flex items-center gap-3">
            <ul
              className="text-muted-foreground hidden items-center gap-3 text-[11px] sm:flex"
              aria-label={td("legend")}
            >
              <li className="flex items-center gap-1">
                <span className="bg-primary h-2 w-2 rounded-full" />
                {td("renewal")}
              </li>
              {(Object.keys(MARKER_STYLES) as CalendarMarkerKind[]).map(
                (kind) => (
                  <li key={kind} className="flex items-center gap-1">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
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
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={prev}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t("subscriptions.calendar.prev")}
          </Button>
          <h2 className="text-lg font-semibold">
            {t("subscriptions.calendar.monthYear", { year, month: monthName })}
          </h2>
          <Button variant="ghost" size="sm" onClick={next}>
            {t("subscriptions.calendar.next")}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-1">
          {weekdays.map((day, index) => (
            <div
              key={day}
              className={cn(
                "py-2 text-center text-sm font-medium",
                index === 0 && "text-destructive",
                index === 6 && "text-primary"
              )}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, index) => {
            if (day === null)
              return <div key={`empty-${index}`} className="h-20 p-1" />;
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
                  "hover:bg-muted relative h-20 rounded-sm border p-1 text-left transition-colors",
                  isToday(day) && "border-primary bg-primary/5",
                  key === selectedDate && "ring-primary ring-2",
                  hasAny && "hover:border-primary/50 cursor-pointer",
                  dow === 0 && "text-destructive",
                  dow === 6 && "text-primary"
                )}
              >
                <span
                  className={cn(
                    "text-sm font-medium",
                    isToday(day) && "text-primary"
                  )}
                >
                  {day}
                </span>
                {renewalCount > 0 && (
                  <Badge
                    data-testid="renewal-badge"
                    variant="secondary"
                    className="bg-primary/10 text-primary absolute right-1 bottom-1 text-xs"
                  >
                    {t("subscriptions.calendar.renewalCount", {
                      count: renewalCount,
                    })}
                  </Badge>
                )}
                {dayMarkers.length > 0 && (
                  <span
                    className="absolute bottom-1.5 left-1.5 flex gap-1"
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
