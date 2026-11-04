// src/app/api/v1/approvals/[id]/route.ts
/**
 * GET /api/v1/approvals/:id — request detail (steps, timeline, viewer flags).
 */
import { getApprovalRequest } from "@/actions/approvals/requests-read";
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";
import { NextRequest, NextResponse } from "next/server";

function idFromUrl(request: NextRequest): string {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? "";
}

export const GET = withApiAuth(
  withLogging("GET /api/v1/approvals/[id]", async (request: NextRequest) => {
    const result = await getApprovalRequest(idFromUrl(request));
    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.message === "FORBIDDEN" ? 403 : 404 }
      );
    }
    return NextResponse.json({ success: true, data: result.data });
  }),
  { permission: "approvals:read" }
);
