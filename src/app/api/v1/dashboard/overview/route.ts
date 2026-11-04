// src/app/api/v1/dashboard/overview/route.ts
/**
 * GET /api/v1/dashboard/overview?scope=
 * KPI row, upcoming renewals and category breakdown in base currency.
 */
import { getDashboardOverview } from "@/actions/discovery/dashboard-overview";
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";
import { NextResponse } from "next/server";

export const GET = withLogging(
  "GET /api/v1/dashboard/overview",
  withApiAuth(
    async (request) => {
      const scope = new URL(request.url).searchParams.get("scope") ?? undefined;
      const result = await getDashboardOverview(scope);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    },
    { permission: "reports:read" }
  )
);
