// src/app/(dashboard)/subscriptions/calendar/page.tsx
/**
 * Renewal calendar (9.4) with trial-ending and cancellation-deadline markers.
 */
import { getRenewalCalendarWithMarkers } from "@/actions/discovery/calendar-extras";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { RenewalCalendarPageClient } from "./page.client";

export const metadata: Metadata = { title: "Renewal calendar" };

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function RenewalCalendarPage({ searchParams }: PageProps) {
  await requirePermissionOrRedirect("subscriptions:read");
  const params = await searchParams;
  const today = new Date();
  const year = Number(params.year ?? today.getFullYear());
  const month = Number(params.month ?? today.getMonth() + 1);
  const validYear =
    Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR
      ? year
      : today.getFullYear();
  const validMonth =
    Number.isInteger(month) && month >= 1 && month <= 12
      ? month
      : today.getMonth() + 1;

  const [t, result] = await Promise.all([
    getTranslations("subscriptions.calendar"),
    getRenewalCalendarWithMarkers(validYear, validMonth),
  ]);

  const initialData =
    result.success && result.data
      ? result.data
      : {
          year: validYear,
          month: validMonth,
          renewals: {},
          markers: {},
          scope: "workspace" as const,
        };

  return (
    <div className="space-y-6">
      <h1 className="text-foreground text-2xl font-medium">{t("title")}</h1>
      <RenewalCalendarPageClient initialData={initialData} />
    </div>
  );
}
