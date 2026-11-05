// src/app/api/v1/extensions/whitelist/sync/route.ts
/**
 * Extension Whitelist Sync API
 * GET: fetch the organization's whitelisted domains
 * POST: sync user-added domains
 */

import { withExtensionAuth } from "@/lib/api/extension-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { whitelistSyncPostSchema } from "@/types/extension-api";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/extensions/whitelist/sync
 * Returns active whitelisted domains
 */
export const GET = withLogging(
  "ext:whitelist-sync",
  withExtensionAuth(async (_request, { auth }) => {
    const whitelistItems = await prisma.extensionWhitelist.findMany({
      where: {
        organizationId: auth.organizationId,
        enabled: true,
      },
      select: {
        pattern: true,
        name: true,
        enabled: true,
      },
      orderBy: { addedAt: "asc" },
    });

    return NextResponse.json({
      whitelist: whitelistItems,
    });
  })
);

/**
 * POST /api/v1/extensions/whitelist/sync
 * Sync domains the user added in the extension
 * source: saved as USER_EXTENSION (replaced by MANUAL in the current schema)
 */
export const POST = withLogging(
  "ext:whitelist-sync-post",
  withExtensionAuth(async (request: NextRequest, { auth }) => {
    try {
      const body = await request.json();
      const parseResult = whitelistSyncPostSchema.safeParse(body);

      if (!parseResult.success) {
        return NextResponse.json(
          {
            success: false,
            error:
              parseResult.error.issues[0]?.message || "Invalid request body",
          },
          { status: 400 }
        );
      }

      const { whitelist } = parseResult.data;

      // Process user-added domains only (source === 'user')
      const userDomains = whitelist.filter((d) => d.source === "user");
      let syncedCount = 0;

      for (const domain of userDomains) {
        await prisma.extensionWhitelist.upsert({
          where: {
            organizationId_pattern: {
              organizationId: auth.organizationId,
              pattern: domain.pattern,
            },
          },
          create: {
            organizationId: auth.organizationId,
            pattern: domain.pattern,
            name: domain.name,
            enabled: domain.enabled,
            source: "MANUAL", // MANUAL is used because the schema does not support USER_EXTENSION
          },
          update: {
            name: domain.name,
            enabled: domain.enabled,
          },
        });
        syncedCount++;
      }

      return NextResponse.json({
        success: true,
        data: {
          syncedCount,
        },
      });
    } catch (error) {
      logger.error({ err: error }, "Whitelist sync error");
      return NextResponse.json(
        { success: false, error: "Failed to sync whitelist" },
        { status: 500 }
      );
    }
  })
);
