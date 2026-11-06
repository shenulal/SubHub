import { NextRequest, NextResponse } from "next/server";

import { createSubscription, getSubscriptions } from "@/actions/subscriptions";
import { auth } from "@/lib/auth";
import { withLogging } from "@/lib/logging";
import { can } from "@/lib/rbac/service";
import {
  jsonBodyToFormData,
  parseSubscriptionListQuery,
} from "@/lib/validations/subscriptions";

/**
 * GET /api/v1/subscriptions
 * - List (filter/sort/pagination)
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
 * - Create a subscription (wraps the FormData-based Server Action)
 * - permission check happens inside the action (`subscriptions:create`)
 */
export const POST = withLogging(
  "POST /api/v1/subscriptions",
  async (request: NextRequest) => {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!(await can("subscriptions:create"))) {
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
