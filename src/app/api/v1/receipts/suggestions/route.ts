// src/app/api/v1/receipts/suggestions/route.ts
/**
 * GET /api/v1/receipts/suggestions?status=&mailboxId=&minConfidence=&search=&page=&limit=
 * Mobile/REST view of the receipt review queue (scoped like the web queue).
 */
import { getReceiptSuggestions } from "@/actions/receipts";
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";
import { NextRequest, NextResponse } from "next/server";

export const GET = withLogging(
  "GET /api/v1/receipts/suggestions",
  withApiAuth(
    async (request: NextRequest) => {
      const params = new URL(request.url).searchParams;
      const pick = (key: string) => params.get(key) ?? undefined;
      const result = await getReceiptSuggestions({
        status: pick("status") as never,
        mailboxId: pick("mailboxId"),
        minConfidence: pick("minConfidence") as never,
        search: pick("search"),
        page: pick("page") as never,
        limit: pick("limit") as never,
      });
      if (!result.success || !result.data) {
        return NextResponse.json(
          { success: false, error: result.error, errors: result.errors },
          { status: result.errors ? 400 : 403 }
        );
      }
      const { items, ...meta } = result.data;
      return NextResponse.json({ success: true, data: items, meta });
    },
    {
      permission: ["mailboxes:connect_own", "mailboxes:manage"],
      permissionMode: "any",
    }
  )
);
