// src/app/api/v1/taxonomy/suggest/route.ts
import { NextRequest, NextResponse } from "next/server";

import { suggestCategory } from "@/actions/taxonomy/auto-categorize";
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";

/** GET /api/v1/taxonomy/suggest?serviceName=…&catalogCategory=…&vendorDomain=… */
export const GET = withLogging(
  "GET /api/v1/taxonomy/suggest",
  withApiAuth(
    async (request: NextRequest) => {
      const params = request.nextUrl.searchParams;
      const serviceName = params.get("serviceName")?.trim();
      if (!serviceName) {
        return NextResponse.json(
          { success: false, error: "serviceName is required" },
          { status: 400 }
        );
      }
      const data = await suggestCategory({
        serviceName,
        catalogCategory: params.get("catalogCategory"),
        vendorDomain: params.get("vendorDomain"),
      });
      return NextResponse.json({ success: true, data });
    },
    { permission: "categories:read" }
  )
);
