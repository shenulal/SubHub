// src/app/(dashboard)/reports/renewal/_components/renewal-calendar-view.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { UpcomingRenewal } from "@/types/dashboard";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

type UrgencyLevel = "urgent" | "warning" | "normal";

interface RenewalCalendarViewProps {
  renewals: UpcomingRenewal[];
  onDateSelect?: (date: string, renewals: UpcomingRenewal[]) => void;
  selectedDate?: string | null;
}

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

// Urgency calculation (days remaining from today)
function getUrgencyLevel(daysUntilRenewal: number): UrgencyLevel {
  if (daysUntilRenewal <= 7) return "urgent";
  if (daysUntilRenewal <= 14) return "warning";
  return "normal";
}

// Colour classes per urgency (standard Tailwind colours)
const urgencyStyles = {
  urgent: {
    dot: "bg-error",
    border: "border-error/50",
    bg: "tonal-error",
    text: "text-error",
  },
  warning: {
    dot: "bg-warning",
    border: "border-warning/50",
    bg: "tonal-warning",
    text: "text-warning",
  },
  normal: {
    dot: "bg-info",
    border: "border-info/50",
    bg: "tonal-info",
    text: "text-info",
  },
};

// Build a date string (YYYY-MM-DD)
function formatDateKey(year: number, month: number, day: number): string {
  const paddedMonth = String(month).padStart(2, "0");
  const paddedDay = String(day).padStart(2, "0");
  return `${year}-${paddedMonth}-${paddedDay}`;
}

// Group renewals by date
function groupRenewalsByDate(
  renewals: UpcomingRenewal[]
): Map<string, UpcomingRenewal[]> {
  const grouped = new Map<string, UpcomingRenewal[]>();

  renewals.forEach((renewal) => {
    const date = new Date(renewal.renewalDate);
    const dateKey = formatDateKey(
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate()
    );

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(renewal);
  });

  return grouped;
}

// Find the most urgent level for a date
function getMostUrgentLevel(renewals: UpcomingRenewal[]): UrgencyLevel {
  let mostUrgent: UrgencyLevel = "normal";

  for (const renewal of renewals) {
    const level = getUrgencyLevel(renewal.daysUntilRenewal);
    if (level === "urgent") return "urgent";
    if (level === "warning") mostUrgent = "warning";
  }

  return mostUrgent;
}

export function RenewalCalendarView({
  renewals,
  onDateSelect,
  selectedDate,
}: RenewalCalendarViewProps) {
  const t = useTranslations("reports.renewal.calendar");
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);

  // Group renewals by date
  const renewalsByDate = groupRenewalsByDate(renewals);

  // Calendar date calculation
  const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth, 0);
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  // Build the calendar grid
  const calendarDays: (number | null)[] = [];

  // Empty cells for the previous month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }

  // Days of the current month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Fill up to 6 weeks with empty cells for the next month
  while (calendarDays.length < 42) {
    calendarDays.push(null);
  }

  // Previous/next month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth() + 1);
  };

  // Check for today
  const isToday = (day: number): boolean => {
    return (
      today.getFullYear() === currentYear &&
      today.getMonth() + 1 === currentMonth &&
      today.getDate() === day
    );
  };

  // Check for the selected date
  const isSelected = (day: number): boolean => {
    return formatDateKey(currentYear, currentMonth, day) === selectedDate;
  };

  // Date click handler
  const handleDateClick = (day: number) => {
    const dateKey = formatDateKey(currentYear, currentMonth, day);
    const dateRenewals = renewalsByDate.get(dateKey) || [];
    onDateSelect?.(dateKey, dateRenewals);
  };

  const monthName = t(`months.${currentMonth}`);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <CardTitle className="flex min-w-0 items-center gap-3">
            <span className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md">
              <CalendarDays className="size-5" />
            </span>
            <span className="truncate">{t("title")}</span>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={handleToday}
          >
            {t("today")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Legend */}
        <div className="bg-muted flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md px-3 py-2">
          <div className="flex items-center gap-2">
            <span
              className={cn("h-3 w-3 rounded-full", urgencyStyles.urgent.dot)}
            />
            <span className="text-sm">{t("legend.urgent")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn("h-3 w-3 rounded-full", urgencyStyles.warning.dot)}
            />
            <span className="text-sm">{t("legend.warning")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn("h-3 w-3 rounded-full", urgencyStyles.normal.dot)}
            />
            <span className="text-sm">{t("legend.normal")}</span>
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={handlePrevMonth}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t("prev")}
          </Button>
          <h2 className="min-w-0 truncate text-lg font-medium">
            {t("yearMonth", { year: currentYear, month: monthName })}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={handleNextMonth}
          >
            {t("next")}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_KEYS.map((key, index) => (
            <div
              key={key}
              className={cn(
                "text-muted-foreground py-2 text-center text-xs font-medium tracking-wide uppercase",
                index === 0 && "text-error",
                index === 6 && "text-info"
              )}
            >
              {t(`weekdays.${key}`)}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="h-16 p-1" />;
            }

            const dateKey = formatDateKey(currentYear, currentMonth, day);
            const dateRenewals = renewalsByDate.get(dateKey) || [];
            const hasRenewals = dateRenewals.length > 0;
            const urgencyLevel = hasRenewals
              ? getMostUrgentLevel(dateRenewals)
              : null;
            const dayOfWeek = index % 7;

            return (
              <button
                key={dateKey}
                onClick={() => handleDateClick(day)}
                className={cn(
                  "relative h-16 min-w-0 rounded-md border p-1.5 text-left transition-colors",
                  "hover:bg-muted",
                  isToday(day) && "border-primary bg-primary/5 font-medium",
                  isSelected(day) && "ring-primary ring-2",
                  hasRenewals &&
                    urgencyLevel && [
                      urgencyStyles[urgencyLevel].border,
                      urgencyStyles[urgencyLevel].bg,
                    ],
                  dayOfWeek === 0 && !hasRenewals && "text-error",
                  dayOfWeek === 6 && !hasRenewals && "text-info"
                )}
              >
                <span
                  className={cn(
                    "text-sm",
                    isToday(day) && "text-primary",
                    hasRenewals &&
                      urgencyLevel &&
                      urgencyStyles[urgencyLevel].text
                  )}
                >
                  {day}
                </span>

                {/* Renewal indicator */}
                {hasRenewals && urgencyLevel && (
                  <div className="absolute right-1 bottom-1 flex items-center gap-1">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        urgencyStyles[urgencyLevel].dot
                      )}
                    />
                    {dateRenewals.length > 1 && (
                      <span className="text-muted-foreground text-xs">
                        {dateRenewals.length}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
