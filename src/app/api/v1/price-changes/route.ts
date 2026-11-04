import { NextRequest, NextResponse } from "next/server";

import {
  acknowledgePriceChange,
  listPriceChanges,
} from "@/actions/subscriptions/price-changes";
import { auth } from "@/lib/auth";
import { withLogging } from "@/lib/logging";
import { parseNumberParam } from "@/lib/validations/subscriptions";

function unauthorized() {
  return NextResponse.json(
    { success: false, error: "Unauthorized" },
    { status: 401 }
  );
}

/** GET /api/v1/price-changes?subscriptionId=&includeAcknowledged=&limit= */
export const GET = withLogging(
  "GET /api/v1/price-changes",
  async (request: NextRequest) => {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { searchParams } = new URL(request.url);
    const result = await listPriceChanges({
      subscriptionId: searchParams.get("subscriptionId") ?? undefined,
      includeAcknowledged: searchParams.get("includeAcknowledged") === "true",
      limit: parseNumberParam(searchParams.get("limit")),
    });
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }
);

/** POST /api/v1/price-changes — body `{ id, applyNewAmount? }` acknowledges an event. */
export const POST = withLogging(
  "POST /api/v1/price-changes",
  async (request: NextRequest) => {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const body = (await request.json().catch(() => ({}))) as {
      id?: unknown;
      applyNewAmount?: unknown;
    };
    if (typeof body.id !== "string" || !body.id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 }
      );
    }
    const result = await acknowledgePriceChange(body.id, {
      applyNewAmount: body.applyNewAmount === true,
    });
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }
);
