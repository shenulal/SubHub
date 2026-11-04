// src/app/(dashboard)/subscriptions/calendar/page.client.tsx
"use client";

/**
 * Calendar client: the URL (`?year=&month=`) is the single source of truth;
 * month data comes from the marker-aware server action and the selected day's
 * renewals from the lifecycle calendar action.
 */
import {
  getRenewalCalendarWithMarkers,
  type CalendarWithMarkers,
} from "@/actions/discovery/calendar-extras";
import { getRenewalsByDate, type RenewalItem } from "@/actions/subscriptions";
import { RenewalCalendar } from "@/components/subscriptions/renewal-calendar";
import { RenewalDayDetail } from "@/components/subscriptions/renewal-day-detail";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

interface RenewalCalendarPageClientProps {
  initialData: CalendarWithMarkers;
}

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const STALE_MS = 5 * 60 * 1000;

function parseYearMonth(
  params: URLSearchParams,
  fallback: { year: number; month: number }
): { year: number; month: number } {
  const year = Number(params.get("year") ?? fallback.year);
  const month = Number(params.get("month") ?? fallback.month);
  return {
    year:
      Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR
        ? year
        : fallback.year,
    month:
      Number.isInteger(month) && month >= 1 && month <= 12
        ? month
        : fallback.month,
  };
}

export function RenewalCalendarPageClient({
  initialData,
}: RenewalCalendarPageClientProps) {
  const t = useTranslations("subscriptions.calendar");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { year, month } = useMemo(
    () =>
      parseYearMonth(searchParams, {
        year: initialData.year,
        month: initialData.month,
      }),
    [searchParams, initialData.year, initialData.month]
  );
  const matchesInitial =
    initialData.year === year && initialData.month === month;

  const monthQuery = useQuery({
    queryKey: ["discovery", "calendar", year, month],
    queryFn: async () => {
      const result = await getRenewalCalendarWithMarkers(year, month);
      if (!result.success || !result.data)
        throw new Error(result.error ?? "failed");
      return result.data;
    },
    initialData: matchesInitial ? initialData : undefined,
    staleTime: STALE_MS,
  });

  const dayQuery = useQuery({
    queryKey: ["discovery", "calendar", "day", selectedDate],
    queryFn: () => getRenewalsByDate(selectedDate as string),
    enabled: Boolean(selectedDate),
    staleTime: STALE_MS,
  });

  const calendarData: CalendarWithMarkers = monthQuery.data ?? {
    ...initialData,
    year,
    month,
    renewals: {},
    markers: {},
  };
  const selectedRenewals: RenewalItem[] = dayQuery.data?.renewals ?? [];
  const selectedMarkers = selectedDate
    ? (calendarData.markers[selectedDate] ?? [])
    : [];

  const handleMonthChange = useCallback(
    (nextYear: number, nextMonth: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("year", String(nextYear));
      params.set("month", String(nextMonth));
      router.push(`/subscriptions/calendar?${params.toString()}`);
      setSelectedDate(null);
    },
    [router, searchParams]
  );

  const isPending = monthQuery.isLoading || monthQuery.isFetching;

  return (
    <div
      className="grid gap-6 lg:grid-cols-[1fr_400px]"
      data-loading={isPending ? "true" : "false"}
    >
      <div className="relative">
        {isPending && (
          <div className="bg-background/80 absolute inset-0 z-10 flex items-center justify-center rounded-sm">
            <Card className="border-border/50 w-full max-w-md rounded-sm shadow-sm">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <Skeleton className="h-6 w-32" />
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 35 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-md" />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        <RenewalCalendar
          calendarData={calendarData}
          markers={calendarData.markers}
          onMonthChange={handleMonthChange}
          onDateSelect={setSelectedDate}
          selectedDate={selectedDate}
        />
      </div>

      <div className="lg:sticky lg:top-4">
        {selectedDate ? (
          dayQuery.isLoading ? (
            <Card className="border-border/50 rounded-sm shadow-sm">
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="mt-2 h-4 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <RenewalDayDetail
              date={selectedDate}
              renewals={selectedRenewals}
              markers={selectedMarkers}
              onClose={() => setSelectedDate(null)}
            />
          )
        ) : (
          <div className="bg-card flex h-64 flex-col items-center justify-center rounded-sm border p-6 text-center">
            <p className="text-muted-foreground whitespace-pre-line">
              {t("selectDateHint")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
