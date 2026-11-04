// src/app/api/v1/me/context/route.ts
import { withApiAuth } from "@/lib/api/auth-middleware";
import { getCurrencyContext } from "@/lib/fx/base-currency";
import { withLogging } from "@/lib/logging";
import { NextResponse } from "next/server";

/**
 * GET /api/v1/me/context
 * Organisation display context for the signed-in user: base currency, enabled
 * currencies, locale, time zone and date format. Permissions are served
 * separately by /api/v1/me/permissions.
 */
export const GET = withLogging(
  "GET /api/v1/me/context",
  withApiAuth(async (_request, { session }) => {
    const data = await getCurrencyContext(session.user.organizationId);
    return NextResponse.json({ success: true, data });
  })
);
