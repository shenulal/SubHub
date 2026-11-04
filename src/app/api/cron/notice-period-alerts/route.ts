// src/app/api/cron/notice-period-alerts/route.ts
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { withCronAuth } from "@/lib/middleware";
import { processNoticePeriodAlerts } from "@/lib/services/subscription/notice-period-alerts";
import { NextResponse } from "next/server";

export const GET = withCronAuth(
  withLogging("cron:notice-period-alerts", async () => {
    try {
      const result = await processNoticePeriodAlerts();
      logger.info({ result }, "[Cron] notice-period alerts processed");
      return NextResponse.json({
        success: result.errors.length === 0,
        ...result,
      });
    } catch (error) {
      logger.error({ err: error }, "[Cron] notice-period alerts failed");
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
