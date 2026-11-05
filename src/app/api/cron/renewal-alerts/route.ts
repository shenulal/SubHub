// src/app/api/cron/renewal-alerts/route.ts
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { withCronAuth } from "@/lib/middleware";
import { processRenewalAlerts } from "@/lib/services/notification";
import { NextResponse } from "next/server";

export const GET = withCronAuth(
  withLogging("cron:renewal-alerts", async () => {
    try {
      logger.info("[Cron] Renewal alert processing started");

      const result = await processRenewalAlerts();

      logger.info({ result }, "[Cron] Renewal alert processing completed");

      return NextResponse.json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error({ err: error }, "[Cron] Renewal alert processing error");

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
