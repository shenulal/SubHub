import { NextRequest, NextResponse } from "next/server";

import { getSubscriptionActivity } from "@/actions/subscriptions/subscription-comments";
import { auth } from "@/lib/auth";
import { withLogging } from "@/lib/logging";
import { parseNumberParam } from "@/lib/validations/subscriptions";

type Params = { params: Promise<{ id: string }> };

/** GET /api/v1/subscriptions/[id]/activity?limit= */
export const GET = withLogging(
  "GET /api/v1/subscriptions/:id/activity",
  async (request: NextRequest, { params }: Params) => {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    const { id } = await params;
    const limit = parseNumberParam(
      new URL(request.url).searchParams.get("limit")
    );
    const result = await getSubscriptionActivity(id, limit);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }
);
