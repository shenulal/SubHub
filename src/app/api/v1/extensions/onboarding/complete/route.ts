// src/app/api/v1/extensions/onboarding/complete/route.ts
/**
 * Extension onboarding completion API
 * Links userId to the ExtensionDevice and sets status to APPROVED
 */

import { withExtensionAuth } from "@/lib/api/extension-auth";
import { prisma } from "@/lib/db";
import { onboardingCompleteSchema } from "@/types/extension-api";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/v1/extensions/onboarding/complete
 * Complete onboarding
 */
export const POST = withExtensionAuth(
  async (request: NextRequest, { auth }) => {
    try {
      const body = await request.json();
      const parseResult = onboardingCompleteSchema.safeParse(body);

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

      const { device_id, email, user_id } = parseResult.data;

      // Verify the user actually belongs to the organization
      const user = await prisma.user.findFirst({
        where: {
          id: user_id,
          organizationId: auth.organizationId,
        },
        select: { id: true, name: true },
      });

      if (!user) {
        return NextResponse.json(
          { success: false, error: "User not found in organization" },
          { status: 404 }
        );
      }

      // Update ExtensionDevice (upsert creates the device if missing)
      const device = await prisma.extensionDevice.upsert({
        where: { deviceKey: device_id },
        create: {
          deviceKey: device_id,
          organizationId: auth.organizationId,
          userId: user.id,
          status: "APPROVED",
          onboardingCompletedAt: new Date(),
          onboardingEmail: email.toLowerCase(),
          lastSeenAt: new Date(),
        },
        update: {
          userId: user.id,
          status: "APPROVED",
          onboardingCompletedAt: new Date(),
          onboardingEmail: email.toLowerCase(),
          lastSeenAt: new Date(),
        },
      });

      // Record onboarding completion in the AuditLog
      await prisma.auditLog.create({
        data: {
          organizationId: auth.organizationId,
          userId: user.id,
          action: "EXTENSION_ONBOARDING_COMPLETED",
          entityType: "ExtensionDevice",
          entityId: device.id,
          metadata: {
            deviceKey: device_id,
            email: email.toLowerCase(),
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          completed: true,
          userId: user.id,
        },
      });
    } catch (error) {
      console.error("Onboarding complete error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to complete onboarding" },
        { status: 500 }
      );
    }
  }
);
