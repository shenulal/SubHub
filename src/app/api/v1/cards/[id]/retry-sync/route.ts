import { NextRequest, NextResponse } from "next/server";

import { syncCardTransactions } from "@/actions/cards/card-sync";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/cards/[id]/retry-sync
 * Retry corporate card sync (triggeredBy: RETRY)
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
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

  const { id } = await context.params;

  // Verify card belongs to user's organization
  const card = await prisma.corporateCard.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
    },
  });

  if (!card) {
    return NextResponse.json({ message: "Card not found" }, { status: 404 });
  }

  try {
    const result = await syncCardTransactions(id, { triggeredBy: "RETRY" });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: "An error occurred while retrying the card sync" },
      { status: 500 }
    );
  }
}
