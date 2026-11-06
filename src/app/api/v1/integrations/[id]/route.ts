import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  deleteIntegration,
  getIntegration,
  updateIntegrationStatus,
} from "@/actions/integrations";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac/service";
import { formatValidationError, uuidParamSchema } from "@/lib/validations/api";

type RouteContext = { params: Promise<{ id: string }> };

// Status update schema (matches IntegrationStatus enum values)
const updateStatusSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "ERROR", "DISCONNECTED"]),
});

/**
 * Auth verification helper
 */
async function requireAuth() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return null;
  }
  return session;
}

/**
 * GET /api/v1/integrations/[id]
 * - Get integration details
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const { id } = await params;

  // Validate ID
  const idResult = uuidParamSchema.safeParse(id);
  if (!idResult.success) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const result = await getIntegration(id);

  if (!result.success) {
    const status =
      result.message === "Integration not found"
        ? 404
        : result.message === "You do not have access permission" ||
            result.message ===
              "You do not have permission to perform this action"
          ? 403
          : 400;
    return NextResponse.json({ error: result.message }, { status });
  }

  return NextResponse.json(result.data?.integration);
}

/**
 * PUT /api/v1/integrations/[id]
 * - Update integration status (ADMIN only)
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // Check ADMIN permission
  if (!(await can("integrations:manage"))) {
    return NextResponse.json(
      { error: "Admin permission required" },
      { status: 403 }
    );
  }

  const { id } = await params;

  // Validate ID
  const idResult = uuidParamSchema.safeParse(id);
  if (!idResult.success) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const body = await request.json();

  // Validate status
  const statusResult = updateStatusSchema.safeParse(body);
  if (!statusResult.success) {
    return NextResponse.json(formatValidationError(statusResult.error), {
      status: 400,
    });
  }

  const result = await updateIntegrationStatus(id, statusResult.data.status);
  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}

/**
 * DELETE /api/v1/integrations/[id]
 * - Delete an integration (ADMIN only)
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // Check ADMIN permission
  if (!(await can("integrations:manage"))) {
    return NextResponse.json(
      { error: "Admin permission required" },
      { status: 403 }
    );
  }

  const { id } = await params;

  // Validate ID
  const idResult = uuidParamSchema.safeParse(id);
  if (!idResult.success) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const result = await deleteIntegration(id);
  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
