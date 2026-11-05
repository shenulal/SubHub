// src/app/api/cron/terminated-users-scan/route.ts
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { withCronAuth } from "@/lib/middleware";
import { processTerminatedUsersScan } from "@/lib/services/terminated-users";
import { NextRequest, NextResponse } from "next/server";

export const GET = withCronAuth(
  withLogging("cron:terminated-users-scan", async (request: NextRequest) => {
    try {
      logger.info(
        "[Cron] Scan for unrevoked accounts of departed users started"
      );

      const result = await processTerminatedUsersScan();

      logger.info({ result }, "[Cron] Departed-user scan completed");

      return NextResponse.json({
        success: result.success,
        processedAt: result.processedAt,
        summary: {
          organizations: result.processedOrganizations,
          terminatedUsers: result.totalTerminatedUsers,
          unrevokedAccess: result.totalUnrevokedAccess,
          emailsSent: result.emailsSent,
        },
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (error) {
      logger.error({ err: error }, "[Cron] Departed-user scan error");

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
