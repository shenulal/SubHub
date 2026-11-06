// src/app/api/v1/approvals/[id]/decision/route.ts
/**
 * POST /api/v1/approvals/:id/decision
 * body: {
 *   action: "approve" | "reject" | "request_info" | "provide_info" | "cancel",
 *   comment?: string,
 *   // approve (all optional; comment may be required by approvals.requireApproveComment)
 *   conditions?: string, costCenterId?: string, categoryId?: string,
 *   effectiveStartDate?: "YYYY-MM-DD",
 *   // reject: reasonId from GET /api/v1/approvals/decision-options (required by the
 *   // current apps; omitted by older builds, which still work with a comment only)
 *   reasonId?: string
 * }
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

const optional = (max: number) =>
  z.string().trim().max(max).optional().nullable();

const bodySchema = z.object({
  action: approvalDecisionActionSchema,
  comment: optional(2000),
  reasonId: optional(64),
  conditions: optional(2000),
  costCenterId: optional(64),
  categoryId: optional(64),
  effectiveStartDate: optional(10),
});

type Body = z.infer<typeof bodySchema>;

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

function decide(id: string, body: Body) {
  const comment = body.comment ?? null;
  switch (body.action) {
    case "approve":
      return approveRequest(id, {
        comment,
        conditions: body.conditions ?? null,
        costCenterId: body.costCenterId ?? null,
        categoryId: body.categoryId ?? null,
        effectiveStartDate: body.effectiveStartDate ?? null,
      });
    case "reject":
      // Legacy clients send only a comment; new clients send the reason too.
      return body.reasonId
        ? rejectRequest(id, { reasonId: body.reasonId, comment: comment ?? "" })
        : rejectRequest(id, comment ?? "");
    case "request_info":
      return requestInfo(id, comment ?? "");
    case "provide_info":
      return provideInfo(id, comment ?? "");
    default:
      return cancelRequest(id, comment);
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
      const result = await decide(id, parsed.data);
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
