// src/app/api/cron/auto-renewal/route.ts
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { withCronAuth } from "@/lib/middleware";
import { processAutoRenewals } from "@/lib/services/subscription/autoRenew";
import { NextRequest, NextResponse } from "next/server";

export const GET = withCronAuth(
  withLogging("cron:auto-renewal", async (request: NextRequest) => {
    try {
      logger.info("[Cron] Auto-renewal date update started");

      const result = await processAutoRenewals();

      logger.info({ result }, "[Cron] Auto-renewal date update completed");

      return NextResponse.json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error({ err: error }, "[Cron] Auto-renewal date update error");

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
