import { NextRequest, NextResponse } from "next/server";

import { createSubscription, getSubscriptions } from "@/actions/subscriptions";
import { auth } from "@/lib/auth";
import { withLogging } from "@/lib/logging";
import {
  jsonBodyToFormData,
  parseSubscriptionListQuery,
} from "@/lib/validations/subscriptions";

/**
 * GET /api/v1/subscriptions
 * - 목록 조회 (필터/정렬/페이지네이션)
 */
export const GET = withLogging(
  "GET /api/v1/subscriptions",
  async (request: NextRequest) => {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await getSubscriptions(
      parseSubscriptionListQuery(searchParams)
    );
    return NextResponse.json(result);
  }
);

/**
 * POST /api/v1/subscriptions
 * - 구독 생성 (FormData 기반 Server Action 래핑)
 * - permission check happens inside the action (`subscriptions:create`)
 */
export const POST = withLogging(
  "POST /api/v1/subscriptions",
  async (request: NextRequest) => {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role === "VIEWER") {
      return NextResponse.json(
        { message: "Read-only users cannot create subscriptions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const result = await createSubscription(
      { success: false },
      jsonBodyToFormData(body)
    );
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  }
);
