// src/app/api/v1/masters/countries/route.ts
import { queryCountries } from "@/actions/platform/masters/queries";
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";
import { NextResponse } from "next/server";

/** GET /api/v1/masters/countries — platform country master (active rows). */
export const GET = withLogging(
  "GET /api/v1/masters/countries",
  withApiAuth(
    async () => {
      const data = await queryCountries();
      return NextResponse.json({
        success: true,
        data,
        meta: { total: data.length },
      });
    },
    { permission: "masters:read" }
  )
);
