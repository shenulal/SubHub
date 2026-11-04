// src/app/api/v1/search/route.ts
/**
 * GET /api/v1/search?q=&limit=
 * Grouped, permission-aware global search (mobile + command palette).
 */
import { globalSearch } from "@/actions/discovery/search";
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";
import { NextResponse } from "next/server";

export const GET = withLogging(
  "GET /api/v1/search",
  withApiAuth(
    async (request) => {
      const { searchParams } = new URL(request.url);
      const q = searchParams.get("q") ?? "";
      const limitRaw = searchParams.get("limit");
      const limit = limitRaw ? Number(limitRaw) : undefined;
      const result = await globalSearch(q, {
        limit: Number.isFinite(limit) ? limit : undefined,
      });
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }
      return NextResponse.json({
        success: true,
        data: result.data,
        meta: result.data?.meta,
      });
    },
    { permission: "subscriptions:read" }
  )
);
