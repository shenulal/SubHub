import { NextRequest, NextResponse } from "next/server";

import { getUser } from "@/actions/users";
import { offboardUser, permanentlyDeleteUser } from "@/actions/users-write";
import { auth } from "@/lib/auth";
import { withLogging } from "@/lib/logging";

/**
 * GET /api/v1/users/[id]
 * - Get user details
 */
export const GET = withLogging(
  "GET /api/v1/users/:id",
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const user = await getUser(id);

    if (!user) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  }
);

/**
 * DELETE /api/v1/users/[id]
 * - Offboard a user (ADMIN only)
 * - Permanently deletes when ?permanent=true
 */
export const DELETE = withLogging(
  "DELETE /api/v1/users/:id",
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const isPermanent =
      request.nextUrl.searchParams.get("permanent") === "true";

    const result = isPermanent
      ? await permanentlyDeleteUser(id)
      : await offboardUser(id);

    if (!result.success) {
      return NextResponse.json({ message: result.message }, { status: 400 });
    }

    return NextResponse.json({ message: result.message });
  }
);
