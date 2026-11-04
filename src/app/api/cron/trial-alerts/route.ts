// src/app/api/cron/trial-alerts/route.ts
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { withCronAuth } from "@/lib/middleware";
import { processTrialAlerts } from "@/lib/services/subscription/trial-alerts";
import { NextResponse } from "next/server";

export const GET = withCronAuth(
  withLogging("cron:trial-alerts", async () => {
    try {
      const result = await processTrialAlerts();
      logger.info({ result }, "[Cron] trial alerts processed");
      return NextResponse.json({
        success: result.errors.length === 0,
        ...result,
      });
    } catch (error) {
      logger.error({ err: error }, "[Cron] trial alerts failed");
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
