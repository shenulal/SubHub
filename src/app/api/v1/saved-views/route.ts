// src/app/api/v1/saved-views/route.ts
/**
 * GET  /api/v1/saved-views?entity=subscriptions
 * POST /api/v1/saved-views  { name, filters, sort?, isShared? }
 */
import {
  createSavedView,
  listSavedViews,
} from "@/actions/discovery/saved-views";
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";
import { NextResponse } from "next/server";

export const GET = withLogging(
  "GET /api/v1/saved-views",
  withApiAuth(
    async (request) => {
      const entity =
        new URL(request.url).searchParams.get("entity") ?? "subscriptions";
      const result = await listSavedViews(entity);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    },
    { permission: "subscriptions:read" }
  )
);

export const POST = withLogging(
  "POST /api/v1/saved-views",
  withApiAuth(
    async (request) => {
      const body = await request.json().catch(() => null);
      const result = await createSavedView(body);
      return NextResponse.json(result, { status: result.success ? 201 : 400 });
    },
    { permission: "subscriptions:read" }
  )
);
