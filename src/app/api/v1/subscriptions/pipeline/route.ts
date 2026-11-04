// src/app/api/v1/subscriptions/pipeline/route.ts
/**
 * GET /api/v1/subscriptions/pipeline?scope=workspace|personal|all
 * Renewal pipeline lanes for mobile clients.
 */
import { getRenewalPipeline } from "@/actions/discovery/pipeline";
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";
import { NextResponse } from "next/server";

export const GET = withLogging(
  "GET /api/v1/subscriptions/pipeline",
  withApiAuth(
    async (request) => {
      const scope = new URL(request.url).searchParams.get("scope") ?? undefined;
      const result = await getRenewalPipeline({ scope });
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    },
    { permission: "subscriptions:read" }
  )
);
