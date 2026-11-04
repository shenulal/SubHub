// src/app/api/cron/price-change-scan/route.ts
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { withCronAuth } from "@/lib/middleware";
import { processPriceChangeScan } from "@/lib/services/subscription/price-change-scan";
import { NextResponse } from "next/server";

export const GET = withCronAuth(
  withLogging("cron:price-change-scan", async () => {
    try {
      const result = await processPriceChangeScan();
      logger.info({ result }, "[Cron] price-change scan processed");
      return NextResponse.json({
        success: result.errors.length === 0,
        ...result,
      });
    } catch (error) {
      logger.error({ err: error }, "[Cron] price-change scan failed");
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
