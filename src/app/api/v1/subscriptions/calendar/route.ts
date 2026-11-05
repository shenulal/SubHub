import { NextRequest, NextResponse } from "next/server";

import { getRenewalCalendar, getRenewalsByDate } from "@/actions/subscriptions";
import { auth } from "@/lib/auth";

/**
 * GET /api/v1/subscriptions/calendar
 * - Get calendar data (year, month parameters)
 * - Get renewals for a specific date (date parameter)
 */
import { withLogging } from "@/lib/logging";

/**
 * GET /api/v1/subscriptions/calendar
 * - Get calendar data (year, month parameters)
 * - Get renewals for a specific date (date parameter)
 */
export const GET = withLogging(
  "GET /api/v1/subscriptions/calendar",
  async (request: NextRequest) => {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Specific date
    const dateParam = searchParams.get("date");
    if (dateParam) {
      const result = await getRenewalsByDate(dateParam);
      return NextResponse.json(result);
    }

    // Monthly calendar data
    const today = new Date();
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");

    const year = yearParam ? parseInt(yearParam, 10) : today.getFullYear();
    const month = monthParam ? parseInt(monthParam, 10) : today.getMonth() + 1;

    // Validation
    const validYear = year >= 2020 && year <= 2100 ? year : today.getFullYear();
    const validMonth = month >= 1 && month <= 12 ? month : today.getMonth() + 1;

    const result = await getRenewalCalendar(validYear, validMonth);
    return NextResponse.json(result);
  }
);
