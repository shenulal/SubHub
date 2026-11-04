// src/app/api/v1/notifications/unread-count/route.ts
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";
import { getUnreadCountFor } from "@/lib/services/notification/inbox";
import { NextResponse } from "next/server";

/** GET /api/v1/notifications/unread-count — polled by the bell every 60s. */
export const GET = withApiAuth(
  withLogging(
    "GET /api/v1/notifications/unread-count",
    async (_request, { session }) => {
      const count = await getUnreadCountFor({
        organizationId: session.user.organizationId,
        userId: session.user.id,
      });
      return NextResponse.json({ success: true, data: { count } });
    }
  ),
  { permission: "notifications:read" }
);
