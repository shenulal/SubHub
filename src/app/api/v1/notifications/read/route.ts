// src/app/api/v1/notifications/read/route.ts
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";
import { markAllReadFor, markReadFor } from "@/lib/services/notification/inbox";
import { markReadSchema } from "@/lib/validations/notifications";
import { NextResponse } from "next/server";

/** POST /api/v1/notifications/read  body: `{ ids: [...] }` or `{ all: true }` */
export const POST = withApiAuth(
  withLogging(
    "POST /api/v1/notifications/read",
    async (request, { session }) => {
      const body = await request.json().catch(() => null);
      const parsed = markReadSchema.safeParse(body);
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
      const scope = {
        organizationId: session.user.organizationId,
        userId: session.user.id,
      };
      const updated =
        "all" in parsed.data
          ? await markAllReadFor(scope)
          : await markReadFor(scope, parsed.data.ids);
      return NextResponse.json({ success: true, data: { updated } });
    }
  ),
  { permission: "notifications:read" }
);
