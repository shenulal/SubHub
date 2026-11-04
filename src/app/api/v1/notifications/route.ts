// src/app/api/v1/notifications/route.ts
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";
import { listNotificationsFor } from "@/lib/services/notification/inbox";
import { listNotificationsSchema } from "@/lib/validations/notifications";
import { NextResponse } from "next/server";

/**
 * GET /api/v1/notifications?cursor=&limit=&unreadOnly=&types=A,B
 * Cursor-paginated inbox for the signed-in member.
 */
export const GET = withApiAuth(
  withLogging("GET /api/v1/notifications", async (request, { session }) => {
    const url = new URL(request.url);
    const typesParam = url.searchParams.get("types");
    const parsed = listNotificationsSchema.safeParse({
      cursor: url.searchParams.get("cursor"),
      limit: url.searchParams.get("limit") ?? undefined,
      unreadOnly: url.searchParams.get("unreadOnly") ?? undefined,
      types: typesParam ? typesParam.split(",").filter(Boolean) : undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid query",
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }
    const page = await listNotificationsFor(
      { organizationId: session.user.organizationId, userId: session.user.id },
      parsed.data
    );
    return NextResponse.json({
      success: true,
      data: page.items,
      meta: { nextCursor: page.nextCursor, unreadCount: page.unreadCount },
    });
  }),
  { permission: "notifications:read" }
);
