// src/app/api/cron/review-apps-scan/route.ts
import { scanUnregisteredDomains } from "@/actions/extensions/review-apps";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { withCronAuth } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";

export const GET = withCronAuth(
  withLogging("cron:review-apps-scan", async (request: NextRequest) => {
    try {
      logger.info("[Cron] Unscanned domain scan started");

      // Fetch all active organizations
      const organizations = await prisma.organization.findMany({
        select: { id: true, name: true },
      });

      const results: Array<{
        organizationId: string;
        organizationName: string | null;
        scanned: number;
        saasFound: number;
        maliciousFound: number;
        error?: string;
      }> = [];

      const MAX_ITERATIONS = 20;

      for (const org of organizations) {
        let orgScanned = 0;
        let orgSaasFound = 0;
        let orgMaliciousFound = 0;
        let orgError: string | undefined;

        try {
          // Repeat until no unscanned domains remain (max 20 iterations)
          for (let i = 0; i < MAX_ITERATIONS; i++) {
            const result = await scanUnregisteredDomains({
              batchSize: 10,
              organizationId: org.id,
            });

            if (!result.success) {
              orgError = result.error;
              break;
            }

            const { scanned, saasFound, maliciousFound } = result.data!;
            orgScanned += scanned;
            orgSaasFound += saasFound;
            orgMaliciousFound += maliciousFound;

            // Stop when there are no more domains to scan
            if (scanned === 0) break;

            logger.info(
              { organizationId: org.id, iteration: i + 1, scanned },
              "[Cron] Batch scan iteration in progress"
            );
          }

          results.push({
            organizationId: org.id,
            organizationName: org.name,
            scanned: orgScanned,
            saasFound: orgSaasFound,
            maliciousFound: orgMaliciousFound,
            ...(orgError ? { error: orgError } : {}),
          });
        } catch (error) {
          logger.error(
            { err: error, organizationId: org.id },
            "[Cron] Per-organization scan error"
          );
          results.push({
            organizationId: org.id,
            organizationName: org.name,
            scanned: orgScanned,
            saasFound: orgSaasFound,
            maliciousFound: orgMaliciousFound,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      const totalScanned = results.reduce((sum, r) => sum + r.scanned, 0);
      const totalSaaS = results.reduce((sum, r) => sum + r.saasFound, 0);
      const totalMalicious = results.reduce(
        (sum, r) => sum + r.maliciousFound,
        0
      );

      logger.info(
        {
          organizations: organizations.length,
          totalScanned,
          totalSaaS,
          totalMalicious,
        },
        "[Cron] Unscanned domain scan completed"
      );

      return NextResponse.json({
        success: true,
        processedAt: new Date().toISOString(),
        summary: {
          organizations: organizations.length,
          totalScanned,
          totalSaaS,
          totalMalicious,
        },
        details: results,
      });
    } catch (error) {
      logger.error({ err: error }, "[Cron] Unscanned domain scan error");

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
