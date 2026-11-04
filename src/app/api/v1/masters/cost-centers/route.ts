// src/app/api/v1/masters/cost-centers/route.ts
import { queryCostCenters } from "@/actions/platform/masters/queries";
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";
import { NextResponse } from "next/server";

/** GET /api/v1/masters/cost-centers — organisation master data for mobile/web clients. */
export const GET = withLogging(
  "GET /api/v1/masters/cost-centers",
  withApiAuth(
    async (_request, { session }) => {
      const data = await queryCostCenters(session.user.organizationId);
      return NextResponse.json({
        success: true,
        data,
        meta: { total: data.length },
      });
    },
    { permission: "masters:read" }
  )
);
