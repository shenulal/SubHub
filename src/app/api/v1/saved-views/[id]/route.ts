// src/app/api/v1/saved-views/[id]/route.ts
/**
 * PATCH  /api/v1/saved-views/:id   { name?, filters?, sort?, isShared? }
 * DELETE /api/v1/saved-views/:id
 * PUT    /api/v1/saved-views/:id/default is expressed as PATCH { default: true }
 */
import {
  deleteSavedView,
  setDefaultView,
  updateSavedView,
} from "@/actions/discovery/saved-views";
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";
import { NextResponse } from "next/server";

function idFromUrl(url: string): string {
  const segments = new URL(url).pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? "";
}

export const PATCH = withLogging(
  "PATCH /api/v1/saved-views/[id]",
  withApiAuth(
    async (request) => {
      const id = idFromUrl(request.url);
      const body = (await request.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (body.default === true) {
        const result = await setDefaultView(
          id,
          typeof body.entity === "string" ? body.entity : undefined
        );
        return NextResponse.json(result, {
          status: result.success ? 200 : 400,
        });
      }
      const result = await updateSavedView({ ...body, id });
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    },
    { permission: "subscriptions:read" }
  )
);

export const DELETE = withLogging(
  "DELETE /api/v1/saved-views/[id]",
  withApiAuth(
    async (request) => {
      const result = await deleteSavedView(idFromUrl(request.url));
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    },
    { permission: "subscriptions:read" }
  )
);
