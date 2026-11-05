"use server";

import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";

// ==================== Calendar Types ====================

export interface RenewalItem {
  subscriptionId: string;
  appId: string;
  appName: string;
  appLogo: string | null;
  planName: string | null;
  amount: number;
  currency: string;
  renewalDate: string; // ISO 8601 string
  status: "ACTIVE" | "EXPIRED" | "CANCELLED" | "PENDING";
}

export interface CalendarData {
  year: number;
  month: number;
  renewals: Record<string, RenewalItem[]>; // key: "YYYY-MM-DD"
}

export interface RenewalsByDateResponse {
  date: string; // ISO 8601 string
  renewals: RenewalItem[];
}

// ==================== Calendar Server Actions ====================

/**
 * Convert a Date to a UTC YYYY-MM-DD string
 * (avoids time-zone drift by normalising everything to UTC)
 */
function formatLocalDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Determine whether the subscription renews in the requested month (respects billingCycle)
 */
function calculateRenewalDateInMonth(
  subscription: {
    renewalDate: Date | null;
    billingCycle: string;
    startDate: Date;
    endDate: Date | null;
  },
  targetYear: number,
  targetMonth: number
): Date | null {
  if (!subscription.renewalDate) return null;

  const renewalDate = subscription.renewalDate;
  const renewalDay = renewalDate.getUTCDate();

  // Start/end of the requested month
  const monthStart = new Date(
    Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0)
  );
  const monthEnd = new Date(
    Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999)
  );

  // Skip if before the subscription start date
  if (subscription.startDate > monthEnd) {
    return null;
  }

  // Skip if after the subscription end date
  if (subscription.endDate && subscription.endDate < monthStart) {
    return null;
  }

  // Compute the renewal date from billingCycle
  if (subscription.billingCycle === "MONTHLY") {
    // Renews on the same day each month (e.g. the 25th)
    const lastDayOfMonth = new Date(
      Date.UTC(targetYear, targetMonth, 0)
    ).getUTCDate();
    const actualDay = Math.min(renewalDay, lastDayOfMonth); // clamp 31 → 30 etc.

    const calculatedDate = new Date(
      Date.UTC(targetYear, targetMonth - 1, actualDay, 0, 0, 0, 0)
    );

    // null if before the start date or after the end date
    if (calculatedDate < subscription.startDate) return null;
    if (subscription.endDate && calculatedDate > subscription.endDate)
      return null;

    return calculatedDate;
  } else if (subscription.billingCycle === "YEARLY") {
    // Renews on the same month/day each year
    const renewalMonth = renewalDate.getUTCMonth() + 1; // 1-12
    if (renewalMonth === targetMonth) {
      const calculatedDate = new Date(
        Date.UTC(targetYear, targetMonth - 1, renewalDay, 0, 0, 0, 0)
      );

      if (calculatedDate < subscription.startDate) return null;
      if (subscription.endDate && calculatedDate > subscription.endDate)
        return null;

      return calculatedDate;
    }
  } else if (subscription.billingCycle === "QUARTERLY") {
    // Renews every 3 months (not implemented yet; add when needed)
    // TODO: implement quarterly renewal logic
  }

  return null;
}

/**
 * Get monthly renewal calendar data
 */
export async function getRenewalCalendar(
  year: number,
  month: number
): Promise<CalendarData> {
  const { organizationId } = await requireOrganization();

  // Check whether the requested month is in the past
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1; // 1-12
  const queryDate = year * 100 + month; // 202603
  const currentDate = currentYear * 100 + currentMonth; // 202602
  const isPastMonth = queryDate < currentDate;

  // Group by date
  const renewals: Record<string, RenewalItem[]> = {};

  if (isPastMonth) {
    // Past months: show only rows that actually have a renewalDate in the DB
    const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const subscriptions = await prisma.subscription.findMany({
      where: {
        organizationId,
        renewalDate: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      include: {
        app: true,
      },
      orderBy: { renewalDate: "asc" },
    });

    for (const sub of subscriptions) {
      if (!sub.renewalDate) continue;

      const dateKey = formatLocalDateKey(sub.renewalDate);

      if (!renewals[dateKey]) {
        renewals[dateKey] = [];
      }

      renewals[dateKey].push({
        subscriptionId: sub.id,
        appId: sub.appId,
        appName: sub.app.name,
        appLogo: sub.app.customLogoUrl,
        planName: sub.notes,
        amount: sub.amount.toNumber(),
        currency: sub.currency,
        renewalDate: sub.renewalDate.toISOString(),
        status: sub.status as RenewalItem["status"],
      });
    }
  } else {
    // Current/future months: apply recurring renewal logic
    const subscriptions = await prisma.subscription.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        renewalDate: { not: null },
      },
      include: {
        app: true,
      },
    });

    for (const sub of subscriptions) {
      if (!sub.renewalDate) continue;

      // Check whether a renewal falls in the requested month
      const calculatedDate = calculateRenewalDateInMonth(
        {
          renewalDate: sub.renewalDate,
          billingCycle: sub.billingCycle,
          startDate: sub.startDate,
          endDate: sub.endDate,
        },
        year,
        month
      );

      if (!calculatedDate) continue;

      const dateKey = formatLocalDateKey(calculatedDate);

      if (!renewals[dateKey]) {
        renewals[dateKey] = [];
      }

      renewals[dateKey].push({
        subscriptionId: sub.id,
        appId: sub.appId,
        appName: sub.app.name,
        appLogo: sub.app.customLogoUrl,
        planName: sub.notes,
        amount: sub.amount.toNumber(),
        currency: sub.currency,
        renewalDate: calculatedDate.toISOString(),
        status: sub.status as RenewalItem["status"],
      });
    }
  }

  return {
    year,
    month,
    renewals,
  };
}

/**
 * Get renewals for a specific date
 */
export async function getRenewalsByDate(
  date: string
): Promise<RenewalsByDateResponse> {
  const { organizationId } = await requireOrganization();

  // Parse the date (YYYY-MM-DD)
  const targetDate = new Date(date);
  const targetYear = targetDate.getUTCFullYear();
  const targetMonth = targetDate.getUTCMonth() + 1; // 1-12
  const targetDay = targetDate.getUTCDate();

  // Compare with today
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const queryYearMonth = targetYear * 100 + targetMonth;
  const currentYearMonth = currentYear * 100 + currentMonth;
  const isPastMonth = queryYearMonth < currentYearMonth;

  const renewals: RenewalItem[] = [];

  if (isPastMonth) {
    // Past months: query the actual renewalDate from the DB
    const startOfDay = new Date(
      Date.UTC(targetYear, targetMonth - 1, targetDay, 0, 0, 0, 0)
    );
    const endOfDay = new Date(
      Date.UTC(targetYear, targetMonth - 1, targetDay, 23, 59, 59, 999)
    );

    const subscriptions = await prisma.subscription.findMany({
      where: {
        organizationId,
        renewalDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        app: true,
      },
      orderBy: { app: { name: "asc" } },
    });

    for (const sub of subscriptions) {
      renewals.push({
        subscriptionId: sub.id,
        appId: sub.appId,
        appName: sub.app.name,
        appLogo: sub.app.customLogoUrl,
        planName: sub.notes,
        amount: sub.amount.toNumber(),
        currency: sub.currency,
        renewalDate: sub.renewalDate?.toISOString() ?? date,
        status: sub.status as RenewalItem["status"],
      });
    }
  } else {
    // Current/future months: apply recurring renewal logic
    const subscriptions = await prisma.subscription.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        renewalDate: { not: null },
      },
      include: {
        app: true,
      },
    });

    for (const sub of subscriptions) {
      if (!sub.renewalDate) continue;

      // Check whether a renewal falls in the requested month
      const calculatedDate = calculateRenewalDateInMonth(
        {
          renewalDate: sub.renewalDate,
          billingCycle: sub.billingCycle,
          startDate: sub.startDate,
          endDate: sub.endDate,
        },
        targetYear,
        targetMonth
      );

      if (!calculatedDate) continue;

      // Check that the computed date matches the requested day
      if (calculatedDate.getUTCDate() === targetDay) {
        renewals.push({
          subscriptionId: sub.id,
          appId: sub.appId,
          appName: sub.app.name,
          appLogo: sub.app.customLogoUrl,
          planName: sub.notes,
          amount: sub.amount.toNumber(),
          currency: sub.currency,
          renewalDate: calculatedDate.toISOString(),
          status: sub.status as RenewalItem["status"],
        });
      }
    }

    // Sort by app name
    renewals.sort((a, b) => a.appName.localeCompare(b.appName));
  }

  return {
    date,
    renewals,
  };
}
