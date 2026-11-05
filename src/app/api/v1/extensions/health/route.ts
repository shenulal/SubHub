// src/app/api/v1/extensions/health/route.ts
/**
 * Extension Health Check API
 * Checks token validity and server connectivity
 */

import { withExtensionAuth } from "@/lib/api/extension-auth";
import { withLogging } from "@/lib/logging";
import { NextResponse } from "next/server";

/**
 * GET /api/v1/extensions/health
 * Validates the token and responds with server status
 */
export const GET = withLogging(
  "ext:health",
  withExtensionAuth(async (_request, { auth }) => {
    return NextResponse.json({
      success: true,
      data: {
        status: "ok",
        timestamp: Date.now(),
        organizationId: auth.organizationId,
      },
    });
  })
);
