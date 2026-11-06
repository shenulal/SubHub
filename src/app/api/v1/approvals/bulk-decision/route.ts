// src/app/api/v1/approvals/bulk-decision/route.ts
/**
 * POST /api/v1/approvals/bulk-decision
 * body: { requestIds: string[], action: "approve" | "reject", comment?, reasonId? }
 * Each request is validated on its own; the response lists succeeded / failed ids.
 */
import { bulkDecideRequests } from "@/actions/approvals/bulk-decisions";
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";
import { NextRequest, NextResponse } from "next/server";

export const POST = withApiAuth(
  withLogging(
    "POST /api/v1/approvals/bulk-decision",
    async (request: NextRequest) => {
      const raw = await request.json().catch(() => null);
      const result = await bulkDecideRequests(raw ?? {});
      if (!result.success || !result.data) {
        return NextResponse.json(
          { success: false, error: result.error, errors: result.errors },
          { status: result.message === "FORBIDDEN" ? 403 : 400 }
        );
      }
      return NextResponse.json({ success: true, data: result.data });
    }
  ),
  { permission: "approvals:decide" }
);
