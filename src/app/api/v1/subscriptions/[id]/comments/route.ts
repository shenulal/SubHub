import { NextRequest, NextResponse } from "next/server";

import {
  addSubscriptionComment,
  listSubscriptionComments,
} from "@/actions/subscriptions/subscription-comments";
import { auth } from "@/lib/auth";
import { withLogging } from "@/lib/logging";

type Params = { params: Promise<{ id: string }> };

function unauthorized() {
  return NextResponse.json(
    { success: false, error: "Unauthorized" },
    { status: 401 }
  );
}

/** GET /api/v1/subscriptions/[id]/comments */
export const GET = withLogging(
  "GET /api/v1/subscriptions/:id/comments",
  async (_request: NextRequest, { params }: Params) => {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { id } = await params;
    const result = await listSubscriptionComments(id);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }
);

/** POST /api/v1/subscriptions/[id]/comments — body `{ body: string }` */
export const POST = withLogging(
  "POST /api/v1/subscriptions/:id/comments",
  async (request: NextRequest, { params }: Params) => {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { body?: unknown };
    const result = await addSubscriptionComment(
      id,
      typeof body.body === "string" ? body.body : ""
    );
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  }
);
