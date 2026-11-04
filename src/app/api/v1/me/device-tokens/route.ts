// src/app/api/v1/me/device-tokens/route.ts
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";
import {
  listDeviceTokens,
  registerDeviceToken,
  removeDeviceToken,
} from "@/lib/services/notification/device-tokens";
import {
  deleteDeviceTokenSchema,
  registerDeviceTokenSchema,
} from "@/lib/validations/notifications";
import { NextResponse } from "next/server";

const PERMISSION = "notifications:manage_own" as const;

/** GET /api/v1/me/device-tokens — devices registered for push. */
export const GET = withApiAuth(
  withLogging("GET /api/v1/me/device-tokens", async (_request, { session }) => {
    const data = await listDeviceTokens(session.user.id);
    return NextResponse.json({ success: true, data });
  }),
  { permission: PERMISSION }
);

/** POST /api/v1/me/device-tokens  body: `{ platform, token, deviceName? }` */
export const POST = withApiAuth(
  withLogging("POST /api/v1/me/device-tokens", async (request, { session }) => {
    const body = await request.json().catch(() => null);
    const parsed = registerDeviceTokenSchema.safeParse(body);
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
    const data = await registerDeviceToken(session.user.id, parsed.data);
    return NextResponse.json({ success: true, data }, { status: 201 });
  }),
  { permission: PERMISSION }
);

/** DELETE /api/v1/me/device-tokens  body: `{ token }` or `{ id }` */
export const DELETE = withApiAuth(
  withLogging(
    "DELETE /api/v1/me/device-tokens",
    async (request, { session }) => {
      const body = await request.json().catch(() => null);
      const parsed = deleteDeviceTokenSchema.safeParse(body);
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
      const removed = await removeDeviceToken(session.user.id, parsed.data);
      return NextResponse.json({ success: true, data: { removed } });
    }
  ),
  { permission: PERMISSION }
);
