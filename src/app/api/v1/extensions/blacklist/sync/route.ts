// src/app/api/v1/extensions/blacklist/sync/route.ts
/**
 * Extension Blacklist Sync API
 * Fetch the organization's blacklisted domains
 */

import { withExtensionAuth } from "@/lib/api/extension-auth";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { NextResponse } from "next/server";

/**
 * GET /api/v1/extensions/blacklist/sync
 * Returns active blacklisted domains
 */
export const GET = withLogging(
  "ext:blacklist-sync",
  withExtensionAuth(async (_request, { auth }) => {
    const blacklistItems = await prisma.extensionBlacklist.findMany({
      where: {
        organizationId: auth.organizationId,
        enabled: true,
      },
      select: {
        pattern: true,
        name: true,
        reason: true,
        enabled: true,
      },
      orderBy: { addedAt: "asc" },
    });

    return NextResponse.json({
      blacklist: blacklistItems,
      version: Date.now().toString(),
    });
  })
);
