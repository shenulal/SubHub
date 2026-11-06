import { NextRequest, NextResponse } from "next/server";

import { syncIntegrationNow } from "@/actions/integrations";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac/service";

/**
 * POST /api/v1/integrations/[id]/sync
 * - Trigger a manual integration sync
 * - Permission: ADMIN only
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Only ADMIN can sync
  if (!(await can("integrations:manage"))) {
    return NextResponse.json(
      { message: "You do not have permission to sync this integration" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const result = await syncIntegrationNow(id);

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
