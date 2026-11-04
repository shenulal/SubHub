// src/app/api/v1/approvals/route.ts
/**
 * GET  /api/v1/approvals — list (filters, pagination); POST — submit a request.
 * Mobile-facing REST surface over the approval server actions.
 */
import { getApprovalRequests } from "@/actions/approvals/requests-read";
import { submitApprovalRequest } from "@/actions/approvals/submit";
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";
import { NextRequest, NextResponse } from "next/server";

function statusFor(message?: string): number {
  if (message === "FORBIDDEN") return 403;
  if (message === "NOT_FOUND") return 404;
  return 400;
}

export const GET = withApiAuth(
  withLogging("GET /api/v1/approvals", async (request: NextRequest) => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const result = await getApprovalRequests(params);
    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error, errors: result.errors },
        { status: statusFor(result.message) }
      );
    }
    const { items, total, page, limit, tab, counts } = result.data;
    return NextResponse.json({
      success: true,
      data: items,
      meta: { total, page, limit, tab, counts },
    });
  }),
  { permission: "approvals:read" }
);

export const POST = withApiAuth(
  withLogging("POST /api/v1/approvals", async (request: NextRequest) => {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const result = await submitApprovalRequest(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, errors: result.errors },
        { status: statusFor(result.message) }
      );
    }
    return NextResponse.json(
      { success: true, data: result.data },
      { status: 201 }
    );
  }),
  { permission: "approvals:create" }
);
