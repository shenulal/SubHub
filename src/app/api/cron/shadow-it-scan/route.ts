// src/app/api/cron/shadow-it-scan/route.ts
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { withCronAuth } from "@/lib/middleware";
import { processShadowITScan } from "@/lib/services/security";
import { NextRequest, NextResponse } from "next/server";

export const GET = withCronAuth(
  withLogging("cron:shadow-it-scan", async (request: NextRequest) => {
    try {
      logger.info("[Cron] Shadow IT scan started");

      const result = await processShadowITScan();

      logger.info({ result }, "[Cron] Shadow IT scan completed");

      return NextResponse.json({
        success: result.success,
        processedAt: result.processedAt,
        summary: {
          organizations: result.processedOrganizations,
          shadowApps: result.totalShadowApps,
          emailsSent: result.emailsSent,
        },
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (error) {
      logger.error({ err: error }, "[Cron] Shadow IT scan error");

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
