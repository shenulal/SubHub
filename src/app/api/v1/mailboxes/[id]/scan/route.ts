// src/app/api/v1/mailboxes/[id]/scan/route.ts
/** POST /api/v1/mailboxes/{id}/scan — run a scan now for one mailbox. */
import { scanMailboxNow } from "@/actions/receipts";
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";
import { NextRequest, NextResponse } from "next/server";

export const POST = withLogging(
  "POST /api/v1/mailboxes/[id]/scan",
  withApiAuth(
    async (request: NextRequest) => {
      const segments = new URL(request.url).pathname.split("/").filter(Boolean);
      const id = decodeURIComponent(segments[segments.length - 2] ?? "");
      const result = await scanMailboxNow(id);
      if (!result.success) {
        const status = /permission/i.test(result.error ?? "")
          ? 403
          : result.data
            ? 502
            : 404;
        return NextResponse.json(
          { success: false, error: result.error, data: result.data ?? null },
          { status }
        );
      }
      return NextResponse.json({ success: true, data: result.data });
    },
    {
      permission: ["mailboxes:connect_own", "mailboxes:manage"],
      permissionMode: "any",
    }
  )
);
