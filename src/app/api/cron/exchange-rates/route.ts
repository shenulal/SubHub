// src/app/api/cron/exchange-rates/route.ts
import { refreshExchangeRates } from "@/lib/fx/refresh";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { withCronAuth } from "@/lib/middleware";
import { NextResponse } from "next/server";

/**
 * Daily exchange-rate refresh (schedule in vercel.json: 02:00 UTC).
 * Fetches USD-based quotes for every currency any organisation has enabled.
 */
export const GET = withCronAuth(
  withLogging("cron:exchange-rates", async () => {
    try {
      const result = await refreshExchangeRates();
      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      logger.error({ err: error }, "[Cron] exchange-rate refresh failed");
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  })
);
