// src/app/api/v1/extensions/login/route.ts
/**
 * Extension Login Capture API
 * Captures login info and runs the HIBP breach check
 */

import { withExtensionAuth } from "@/lib/api/extension-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { bridgeLoginToAppAccess } from "@/lib/services/discovery/login-access-bridge";
import { checkCredentialHIBP } from "@/lib/services/hibp/breach-checker";
import { loginCaptureSchema } from "@/types/extension-api";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/v1/extensions/login
 * Capture and store login info
 * Optionally runs the HIBP breach check
 */
export const POST = withLogging(
  "ext:login",
  withExtensionAuth(async (request: NextRequest, { auth }) => {
    try {
      const body = await request.json();
      const parseResult = loginCaptureSchema.safeParse(body);

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

      const {
        device_id,
        domain,
        username,
        password_hash,
        auth_type,
        captured_at,
      } = parseResult.data;

      // Run the HIBP check (async; the login event is saved even if it fails)
      let hibpResult = {
        checked: false,
        breached: false,
        count: undefined as number | undefined,
      };
      try {
        const hibpCheck = await checkCredentialHIBP(password_hash);
        hibpResult = {
          checked: hibpCheck.checked,
          breached: hibpCheck.breached,
          count: hibpCheck.count,
        };
      } catch (hibpError) {
        logger.error({ err: hibpError }, "HIBP check failed");
      }

      // Save the login event
      const loginEvent = await prisma.extensionLoginEvent.create({
        data: {
          organizationId: auth.organizationId,
          deviceId: device_id,
          domain,
          username,
          passwordHash: password_hash,
          authType: auth_type,
          capturedAt: new Date(captured_at),
          hibpChecked: hibpResult.checked,
          hibpBreached: hibpResult.breached,
          hibpBreachCount: hibpResult.count,
        },
        select: {
          id: true,
        },
      });

      // Non-blocking bridge call: link login domain → UserAppAccess
      bridgeLoginToAppAccess({
        domain,
        deviceId: device_id,
        organizationId: auth.organizationId,
        capturedAt: new Date(captured_at),
      }).catch((err) => logger.error({ err, domain }, "Login bridge failed"));

      return NextResponse.json({
        success: true,
        data: {
          id: loginEvent.id,
          hibp: {
            checked: hibpResult.checked,
            breached: hibpResult.breached,
            breach_count: hibpResult.count,
          },
        },
      });
    } catch (error) {
      logger.error({ err: error }, "Login capture error");
      return NextResponse.json(
        { success: false, error: "Failed to capture login" },
        { status: 500 }
      );
    }
  })
);
