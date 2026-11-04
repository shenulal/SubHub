// src/app/api/v1/taxonomy/categories/route.ts
import { NextRequest, NextResponse } from "next/server";

import { getCategoryTree } from "@/actions/taxonomy/categories";
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";

/** GET /api/v1/taxonomy/categories?includeArchived=true — two-level category tree. */
export const GET = withLogging(
  "GET /api/v1/taxonomy/categories",
  withApiAuth(
    async (request: NextRequest) => {
      const includeArchived =
        request.nextUrl.searchParams.get("includeArchived") === "true";
      const data = await getCategoryTree({ includeArchived });
      return NextResponse.json({ success: true, data });
    },
    { permission: "categories:read" }
  )
);
