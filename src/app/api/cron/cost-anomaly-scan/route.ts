// src/app/api/cron/cost-anomaly-scan/route.ts
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { withCronAuth } from "@/lib/middleware";
import { processCostAnomalyScan } from "@/lib/services/cost";
import { NextRequest, NextResponse } from "next/server";

export const GET = withCronAuth(
  withLogging("cron:cost-anomaly-scan", async (request: NextRequest) => {
    try {
      logger.info("[Cron] Cost anomaly scan started");

      const result = await processCostAnomalyScan();

      logger.info({ result }, "[Cron] Cost anomaly scan completed");

      return NextResponse.json({
        success: result.success,
        processedAt: result.processedAt,
        summary: {
          organizations: result.processedOrganizations,
          anomalies: result.anomaliesFound,
          emailsSent: result.emailsSent,
        },
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (error) {
      logger.error({ err: error }, "[Cron] Cost anomaly scan error");

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
