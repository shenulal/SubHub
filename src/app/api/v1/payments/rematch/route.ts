import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac/service";
import { rematchRecords } from "@/lib/services/payment/rematch-service";

const VALID_RECORD_TYPES = ["payment", "card-transaction"] as const;
type RecordType = (typeof VALID_RECORD_TYPES)[number];

/**
 * POST /api/v1/payments/rematch
 * Rematch payment records or card transactions
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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
  if (!(await can("payments:manage"))) {
    return NextResponse.json(
      { success: false, error: "Forbidden: missing permission" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid request body" },
      { status: 400 }
    );
  }

  const { recordType, recordIds } = body as {
    recordType?: unknown;
    recordIds?: unknown;
  };

  if (!recordType || !VALID_RECORD_TYPES.includes(recordType as RecordType)) {
    return NextResponse.json(
      {
        message: 'recordType must be "payment" or "card-transaction"',
      },
      { status: 400 }
    );
  }

  if (!Array.isArray(recordIds) || recordIds.length === 0) {
    return NextResponse.json(
      { message: "recordIds must be a non-empty array" },
      { status: 400 }
    );
  }

  try {
    const result = await rematchRecords({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      recordType: recordType as RecordType,
      recordIds: recordIds as string[],
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Rematching is already in progress"
    ) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { message: "An error occurred while rematching" },
      { status: 500 }
    );
  }
}
