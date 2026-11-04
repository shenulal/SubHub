// src/app/api/v1/mailboxes/route.ts
/** GET /api/v1/mailboxes — connected mailboxes visible to the caller. */
import { getMailboxes } from "@/actions/receipts";
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";
import { getProviderAvailability } from "@/lib/services/receipts/providers";
import { NextResponse } from "next/server";

export const GET = withLogging(
  "GET /api/v1/mailboxes",
  withApiAuth(
    async () => {
      const result = await getMailboxes();
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 403 }
        );
      }
      return NextResponse.json({
        success: true,
        data: result.data ?? [],
        meta: { providers: getProviderAvailability() },
      });
    },
    {
      permission: ["mailboxes:connect_own", "mailboxes:manage"],
      permissionMode: "any",
    }
  )
);
