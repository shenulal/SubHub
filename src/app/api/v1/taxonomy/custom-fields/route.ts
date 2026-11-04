// src/app/api/v1/taxonomy/custom-fields/route.ts
import { NextRequest, NextResponse } from "next/server";

import { getCustomFieldDefinitions } from "@/actions/taxonomy/custom-fields";
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";

/** GET /api/v1/taxonomy/custom-fields — active custom field definitions. */
export const GET = withLogging(
  "GET /api/v1/taxonomy/custom-fields",
  withApiAuth(
    async (request: NextRequest) => {
      const includeArchived =
        request.nextUrl.searchParams.get("includeArchived") === "true";
      const data = await getCustomFieldDefinitions({ includeArchived });
      return NextResponse.json({ success: true, data });
    },
    { permission: "custom_fields:read" }
  )
);
