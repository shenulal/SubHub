import { NextRequest, NextResponse } from "next/server";

import {
  deleteSubscription,
  getSubscription,
  updateSubscription,
} from "@/actions/subscriptions";
import { auth } from "@/lib/auth";
import { jsonBodyToFormData } from "@/lib/validations/subscriptions";

/**
 * GET /api/v1/subscriptions/[id]
 * - Get subscription details
 */
import { withLogging } from "@/lib/logging";

/**
 * GET /api/v1/subscriptions/[id]
 * - Get subscription details
 */
export const GET = withLogging(
  "GET /api/v1/subscriptions/:id",
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const subscription = await getSubscription(id);
    if (!subscription) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    return NextResponse.json(subscription);
  }
);

/**
 * PUT /api/v1/subscriptions/[id]
 * - Update a subscription
 * - permission: subscriptions:update / subscriptions:delete (checked in the action)
 */

/**
 * PUT /api/v1/subscriptions/[id]
 * - Update a subscription
 * - permission: subscriptions:update / subscriptions:delete (checked in the action)
 */
export const PUT = withLogging(
  "PUT /api/v1/subscriptions/:id",
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const result = await updateSubscription(
      id,
      { success: false },
      jsonBodyToFormData(body)
    );
    if (!result.success) {
      const status = result.message?.includes("permission") ? 403 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  }
);

/**
 * DELETE /api/v1/subscriptions/[id]
 * - Delete a subscription
 * - permission: subscriptions:update / subscriptions:delete (checked in the action)
 */

/**
 * DELETE /api/v1/subscriptions/[id]
 * - Delete a subscription
 * - permission: subscriptions:update / subscriptions:delete (checked in the action)
 */
export const DELETE = withLogging(
  "DELETE /api/v1/subscriptions/:id",
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const result = await deleteSubscription(id);
    if (!result.success) {
      const status = result.message?.includes("permission") ? 403 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  }
);
