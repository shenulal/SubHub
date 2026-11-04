// src/app/api/v1/taxonomy/tags/route.ts
import { NextRequest, NextResponse } from "next/server";

import { listTags, searchTags } from "@/actions/taxonomy/tags";
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";

/** GET /api/v1/taxonomy/tags?q=…&limit=… — all tags, or a search when `q` is given. */
export const GET = withLogging(
  "GET /api/v1/taxonomy/tags",
  withApiAuth(
    async (request: NextRequest) => {
      const params = request.nextUrl.searchParams;
      const q = params.get("q");
      const limit = Number(params.get("limit") ?? "") || undefined;
      const data = q !== null ? await searchTags(q, limit) : await listTags();
      return NextResponse.json({ success: true, data });
    },
    { permission: "tags:read" }
  )
);
