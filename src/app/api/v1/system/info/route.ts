// src/app/api/v1/system/info/route.ts
import { getDeploymentInfo } from "@/lib/deployment/mode";
import { withLogging } from "@/lib/logging";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/system/info
 * Public, non-sensitive installation facts for web and mobile clients:
 * the deployment mode (`single-tenant` | `saas`), its label and whether the
 * installation is multi-tenant. Also usable as a liveness probe.
 */
export const GET = withLogging("GET /api/v1/system/info", async () =>
  NextResponse.json(
    { success: true, data: { deployment: getDeploymentInfo() } },
    { headers: { "Cache-Control": "no-store" } }
  )
);
