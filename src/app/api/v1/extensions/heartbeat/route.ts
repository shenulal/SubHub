// src/app/api/v1/extensions/heartbeat/route.ts
/**
 * Extension Heartbeat API
 * Updates device lastSeenAt and refreshes metadata
 */

import { withExtensionAuth } from "@/lib/api/extension-auth";
import { prisma } from "@/lib/db";
import { heartbeatSchema } from "@/types/extension-api";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/v1/extensions/heartbeat
 * Receive heartbeat → update lastSeenAt
 */
export const POST = withExtensionAuth(
  async (request: NextRequest, { auth }) => {
    try {
      const body = await request.json();
      const parseResult = heartbeatSchema.safeParse(body);

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

      const { device_id, extension_version, browser_info, os_info } =
        parseResult.data;

      // Update ExtensionDevice (create if missing)
      await prisma.extensionDevice.upsert({
        where: { deviceKey: device_id },
        create: {
          deviceKey: device_id,
          organizationId: auth.organizationId,
          lastSeenAt: new Date(),
          extensionVersion: extension_version,
          browserInfo: browser_info,
          osInfo: os_info,
        },
        update: {
          lastSeenAt: new Date(),
          ...(extension_version && { extensionVersion: extension_version }),
          ...(browser_info && { browserInfo: browser_info }),
          ...(os_info && { osInfo: os_info }),
        },
      });

      return NextResponse.json({
        success: true,
        data: { timestamp: Date.now() },
      });
    } catch (error) {
      console.error("Heartbeat error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to process heartbeat" },
        { status: 500 }
      );
    }
  }
);
