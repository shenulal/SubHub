import { NextRequest, NextResponse } from "next/server";

import {
  archiveSubscription,
  cancelSubscription,
  pauseSubscription,
  restoreSubscription,
  resumeSubscription,
} from "@/actions/subscriptions/subscription-lifecycle";
import { auth } from "@/lib/auth";
import { withLogging } from "@/lib/logging";
import { lifecycleStatusActionSchema } from "@/lib/validations/subscriptions";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/subscriptions/[id]/status
 * Body: `{ action: "pause" | "resume" | "archive" | "restore" | "cancel", effectiveDate? }`
 */
export const POST = withLogging(
  "POST /api/v1/subscriptions/:id/status",
  async (request: NextRequest, { params }: Params) => {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = lifecycleStatusActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400 }
      );
    }

    const { action, effectiveDate } = parsed.data;
    const result =
      action === "pause"
        ? await pauseSubscription(id)
        : action === "resume"
          ? await resumeSubscription(id)
          : action === "archive"
            ? await archiveSubscription(id)
            : action === "restore"
              ? await restoreSubscription(id)
              : await cancelSubscription(id, { effectiveDate });

    const status = result.success
      ? 200
      : result.error?.includes("permission")
        ? 403
        : result.error?.includes("not found")
          ? 404
          : 400;
    return NextResponse.json(result, { status });
  }
);
