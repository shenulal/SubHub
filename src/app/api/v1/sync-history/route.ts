import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac/service";
import { getSyncHistories } from "@/lib/services/payment/sync-history-service";
import type { SyncType } from "@prisma/client";

/**
 * GET /api/v1/sync-history
 * List sync history (paginated)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!session.user.organizationId) {
    return NextResponse.json(
      { message: "Organization information is required" },
      { status: 401 }
    );
  }
  if (!(await can("payments:read"))) {
    return NextResponse.json(
      { success: false, error: "Forbidden: missing permission" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "20");
  const offset = (page - 1) * limit;

  const corporateCardId = searchParams.get("corporateCardId") ?? undefined;
  const typeParam = searchParams.get("type");
  const type = typeParam ? (typeParam as SyncType) : undefined;

  try {
    const result = await getSyncHistories({
      organizationId: session.user.organizationId,
      corporateCardId,
      type,
      limit,
      offset,
    });

    return NextResponse.json({
      data: result.data,
      total: result.total,
      page,
      limit,
    });
  } catch (error) {
    return NextResponse.json(
      { message: "An error occurred while fetching sync history" },
      { status: 500 }
    );
  }
}
