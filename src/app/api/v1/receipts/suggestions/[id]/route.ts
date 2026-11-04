// src/app/api/v1/receipts/suggestions/[id]/route.ts
/**
 * POST /api/v1/receipts/suggestions/{id}
 * Body: { action: "accept", data } | { action: "dismiss" } | { action: "link", data }
 */
import {
  acceptReceiptSuggestion,
  dismissReceiptSuggestions,
  linkReceiptSuggestion,
} from "@/actions/receipts";
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";
import { suggestionApiActionSchema } from "@/lib/validations/receipts";
import type { ActionState } from "@/types";
import { NextRequest, NextResponse } from "next/server";

function idFromUrl(request: NextRequest): string {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  return decodeURIComponent(segments[segments.length - 1] ?? "");
}

function respond<T>(result: ActionState<T>) {
  if (result.success) {
    return NextResponse.json({
      success: true,
      data: result.data ?? null,
      message: result.message,
    });
  }
  const status = result.errors
    ? 400
    : /permission/i.test(result.error ?? "")
      ? 403
      : 404;
  return NextResponse.json(
    { success: false, error: result.error, errors: result.errors },
    { status }
  );
}

export const POST = withLogging(
  "POST /api/v1/receipts/suggestions/[id]",
  withApiAuth(
    async (request: NextRequest) => {
      const id = idFromUrl(request);
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { success: false, error: "Invalid JSON body" },
          { status: 400 }
        );
      }
      const parsed = suggestionApiActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            error: parsed.error.issues[0]?.message ?? "Invalid body",
          },
          { status: 400 }
        );
      }
      switch (parsed.data.action) {
        case "accept":
          return respond(await acceptReceiptSuggestion(id, parsed.data.data));
        case "link":
          return respond(await linkReceiptSuggestion(id, parsed.data.data));
        case "dismiss":
          return respond(await dismissReceiptSuggestions([id]));
      }
    },
    {
      permission: ["mailboxes:connect_own", "mailboxes:manage"],
      permissionMode: "any",
    }
  )
);
