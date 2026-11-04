// src/app/api/v1/me/permissions/route.ts
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { withLogging } from "@/lib/logging";
import { getUserPermissionSet } from "@/lib/rbac/service";

/**
 * GET /api/v1/me/permissions
 * Effective permission keys for the signed-in user (drives UI gating and mobile clients).
 */
export const GET = withLogging("GET /api/v1/me/permissions", async () => {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  const set = await getUserPermissionSet(
    session.user.id,
    session.user.organizationId ?? null
  );
  return NextResponse.json({
    success: true,
    data: {
      userId: session.user.id,
      organizationId: session.user.organizationId ?? null,
      role: session.user.role,
      permissions: Array.from(set).sort(),
    },
  });
});
