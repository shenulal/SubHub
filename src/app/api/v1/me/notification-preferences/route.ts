// src/app/api/v1/me/notification-preferences/route.ts
import { withApiAuth } from "@/lib/api/auth-middleware";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import {
  PreferenceValidationError,
  getPreferenceMatrix,
  savePreferenceCells,
  saveUserReminderLeadDays,
} from "@/lib/services/notification/preferences";
import { updatePreferencesSchema } from "@/lib/validations/notifications";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

const PERMISSION = "notifications:manage_own" as const;

/** GET /api/v1/me/notification-preferences — event × channel matrix + lead days. */
export const GET = withApiAuth(
  withLogging(
    "GET /api/v1/me/notification-preferences",
    async (_request, { session }) => {
      const data = await getPreferenceMatrix(
        session.user.organizationId,
        session.user.id
      );
      return NextResponse.json({ success: true, data });
    }
  ),
  { permission: PERMISSION }
);

/** PUT /api/v1/me/notification-preferences  body: `{ cells?, reminderLeadDays? }` */
export const PUT = withApiAuth(
  withLogging(
    "PUT /api/v1/me/notification-preferences",
    async (request, { session }) => {
      const body = await request.json().catch(() => null);
      const parsed = updatePreferencesSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid body",
            errors: parsed.error.flatten(),
          },
          { status: 400 }
        );
      }
      const { organizationId, id: userId } = session.user;
      try {
        if (parsed.data.cells?.length) {
          await savePreferenceCells(userId, parsed.data.cells);
        }
        if (parsed.data.reminderLeadDays) {
          await saveUserReminderLeadDays(
            organizationId,
            userId,
            parsed.data.reminderLeadDays
          );
        }
      } catch (error) {
        if (error instanceof PreferenceValidationError) {
          return NextResponse.json(
            { success: false, error: error.message },
            { status: 422 }
          );
        }
        throw error;
      }
      await prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          action: "UPDATE_NOTIFICATION_PREFERENCES",
          entityType: "NotificationPreference",
          entityId: userId,
          changes: parsed.data as Prisma.InputJsonValue,
          metadata: { source: "api" },
        },
      });
      const data = await getPreferenceMatrix(organizationId, userId);
      return NextResponse.json({ success: true, data });
    }
  ),
  { permission: PERMISSION }
);
