import { NextRequest, NextResponse } from "next/server";

import { checkDuplicate } from "@/actions/subscriptions/subscription-lifecycle";
import { auth } from "@/lib/auth";
import { withLogging } from "@/lib/logging";

/** GET /api/v1/subscriptions/duplicates?name=&vendorDomain=&excludeId= */
export const GET = withLogging(
  "GET /api/v1/subscriptions/duplicates",
  async (request: NextRequest) => {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    const { searchParams } = new URL(request.url);
    const result = await checkDuplicate(
      searchParams.get("name") ?? "",
      searchParams.get("vendorDomain"),
      searchParams.get("excludeId") ?? undefined
    );
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }
);
