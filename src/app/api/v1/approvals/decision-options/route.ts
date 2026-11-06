// src/app/api/v1/approvals/decision-options/route.ts
/**
 * GET /api/v1/approvals/decision-options — pick lists for the decision form:
 * active rejection reasons, active cost centres, whether an approval comment
 * is mandatory. Requires `approvals:decide`.
 */
import { getDecisionFormOptions } from "@/actions/approvals/decision-options";
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";
import { NextResponse } from "next/server";

export const GET = withApiAuth(
  withLogging("GET /api/v1/approvals/decision-options", async () => {
    const result = await getDecisionFormOptions();
    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.message === "FORBIDDEN" ? 403 : 400 }
      );
    }
    return NextResponse.json({ success: true, data: result.data });
  }),
  { permission: "approvals:decide" }
);
