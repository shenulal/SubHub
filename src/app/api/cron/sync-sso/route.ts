// src/app/api/cron/sync-sso/route.ts
/**
 * SSO sync cron job
 * Vercel Cron: runs daily at midnight (UTC)
 *
 * Environment variables:
 * - CRON_SECRET: Vercel Cron auth token
 */

import { prisma } from "@/lib/db";
import { discoverAppsFromGoogle } from "@/lib/services/discovery";
import {
  GoogleWorkspaceService,
  syncUsersFromGoogle,
} from "@/lib/services/sso";
import type { ServiceAccountCredentials, SyncResult } from "@/types/sso";
import type { Integration } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

// Parse integration credentials
function parseCredentials(
  integration: Integration
): ServiceAccountCredentials | null {
  try {
    const credentials = integration.credentials as {
      clientEmail?: string;
      privateKey?: string;
      subject?: string;
    };

    if (
      !credentials.clientEmail ||
      !credentials.privateKey ||
      !credentials.subject
    ) {
      return null;
    }

    return {
      clientEmail: credentials.clientEmail,
      privateKey: credentials.privateKey,
      subject: credentials.subject,
    };
  } catch {
    return null;
  }
}

interface SyncJobResult {
  integrationId: string;
  organizationId: string;
  type: string;
  userSync?: SyncResult;
  appDiscovery?: SyncResult;
  error?: string;
}

import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { withCronAuth } from "@/lib/middleware";

export const GET = withCronAuth(
  withLogging("cron:sync-sso", async (request: NextRequest) => {
    const startTime = Date.now();
    const results: SyncJobResult[] = [];

    try {
      // Fetch all active integrations
      const integrations = await prisma.integration.findMany({
        where: {
          status: "ACTIVE",
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      logger.info(
        `[Cron] Starting SSO sync for ${integrations.length} integrations`
      );

      // Process each integration
      for (const integration of integrations) {
        const jobResult: SyncJobResult = {
          integrationId: integration.id,
          organizationId: integration.organizationId,
          type: integration.type,
        };

        try {
          // Only Google Workspace is processed
          if (integration.type !== "GOOGLE_WORKSPACE") {
            logger.info(
              `[Cron] Skipping non-Google integration: ${integration.id}`
            );
            continue;
          }

          // Parse credentials
          const credentials = parseCredentials(integration);
          if (!credentials) {
            jobResult.error = "Invalid credentials";
            results.push(jobResult);
            continue;
          }

          // Create the Google Workspace service
          const googleService = new GoogleWorkspaceService(credentials);

          // 1. Sync users
          logger.info(
            `[Cron] Syncing users for integration: ${integration.id}`
          );
          const userSyncResult = await syncUsersFromGoogle(
            integration,
            googleService
          );
          jobResult.userSync = userSyncResult;

          // 2. Discover apps
          logger.info(
            `[Cron] Discovering apps for integration: ${integration.id}`
          );
          const appDiscoveryResult = await discoverAppsFromGoogle(
            integration,
            googleService,
            {
              minUsers: 1,
              matchCatalog: true,
              updateExisting: true,
            }
          );
          jobResult.appDiscovery = appDiscoveryResult;

          // Update the integration status
          await prisma.integration.update({
            where: { id: integration.id },
            data: {
              lastSyncAt: new Date(),
              lastError: null,
            },
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          jobResult.error = errorMessage;

          // Update the integration error status
          await prisma.integration.update({
            where: { id: integration.id },
            data: {
              lastError: errorMessage,
            },
          });

          logger.error(
            { integrationId: integration.id, err: errorMessage },
            "[Cron] Error syncing integration"
          );
        }

        results.push(jobResult);
      }

      const duration = Date.now() - startTime;
      const successCount = results.filter((r) => !r.error).length;
      const errorCount = results.filter((r) => r.error).length;

      logger.info(
        `[Cron] SSO sync completed in ${duration}ms - Success: ${successCount}, Errors: ${errorCount}`
      );

      return NextResponse.json({
        success: true,
        summary: {
          totalIntegrations: integrations.length,
          processed: results.length,
          successful: successCount,
          errors: errorCount,
          duration,
        },
        results,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error({ err: errorMessage }, "[Cron] Fatal error in SSO sync");

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          duration: Date.now() - startTime,
        },
        { status: 500 }
      );
    }
  })
);
