// src/app/api/v1/approvals/[id]/decision/route.ts
/**
 * POST /api/v1/approvals/:id/decision
 * body: { action: "approve" | "reject" | "request_info" | "provide_info" | "cancel", comment?: string }
 */
import {
  approveRequest,
  cancelRequest,
  provideInfo,
  rejectRequest,
  requestInfo,
} from "@/actions/approvals/decisions";
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";
import { approvalDecisionActionSchema } from "@/lib/validations/approvals";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  action: approvalDecisionActionSchema,
  comment: z.string().trim().max(2000).optional().nullable(),
});

function idFromUrl(request: NextRequest): string {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  // .../approvals/:id/decision
  return segments[segments.length - 2] ?? "";
}

function statusFor(message?: string): number {
  switch (message) {
    case "FORBIDDEN":
    case "NOT_APPROVER":
    case "NOT_REQUESTER":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "NOT_PENDING":
    case "INVALID_STATE":
      return 409;
    default:
      return 400;
  }
}

export const POST = withApiAuth(
  withLogging(
    "POST /api/v1/approvals/[id]/decision",
    async (request: NextRequest) => {
      const id = idFromUrl(request);
      const raw = await request.json().catch(() => null);
      const parsed = bodySchema.safeParse(raw);
      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid body",
            errors: parsed.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }
      const { action, comment } = parsed.data;
      const result =
        action === "approve"
          ? await approveRequest(id, comment)
          : action === "reject"
            ? await rejectRequest(id, comment ?? "")
            : action === "request_info"
              ? await requestInfo(id, comment ?? "")
              : action === "provide_info"
                ? await provideInfo(id, comment ?? "")
                : await cancelRequest(id, comment);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error, errors: result.errors },
          { status: statusFor(result.message) }
        );
      }
      return NextResponse.json({ success: true, data: result.data });
    }
  ),
  { permission: "approvals:read" }
);
