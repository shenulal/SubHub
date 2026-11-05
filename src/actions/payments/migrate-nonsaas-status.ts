"use server";

import { getCachedSession } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { ActionState } from "@/types";

interface MigrationResult {
  cardTransactionsUpdated: number;
  paymentRecordsUpdated: number;
}

/**
 * Migrates matchStatus of existing Non-SaaS payment data from PENDING → UNMATCHED
 *
 * Scope: matchStatus=PENDING AND matchedAppId IS NULL (pipeline finished but still PENDING)
 * - Cancelled transactions (useDiv contains the Hyphen cancellation marker) are excluded (stay PENDING)
 *
 * Temporary Server Action that can be removed after running once
 */
export async function migrateNonSaaSMatchStatus(): Promise<
  ActionState<MigrationResult>
> {
  try {
    const session = await getCachedSession();
    if (!session?.user?.organizationId) {
      return { success: false, message: "Authentication required" };
    }

    if (session.user.role !== "ADMIN") {
      return { success: false, message: "Only admins can run this" };
    }

    const organizationId = session.user.organizationId;

    // CardTransaction: PENDING + matchedAppId=null, excluding cancelled transactions
    const cardResult = await prisma.cardTransaction.updateMany({
      where: {
        organizationId,
        matchStatus: "PENDING",
        matchedAppId: null,
        NOT: {
          // Kept in Korean: matches the cancellation marker in Hyphen card API useDiv data
          useDiv: { contains: "취소" },
        },
      },
      data: {
        matchStatus: "UNMATCHED",
      },
    });

    // PaymentRecord: PENDING + matchedAppId=null
    const csvResult = await prisma.paymentRecord.updateMany({
      where: {
        organizationId,
        matchStatus: "PENDING",
        matchedAppId: null,
      },
      data: {
        matchStatus: "UNMATCHED",
      },
    });

    logger.info(
      {
        organizationId,
        cardTransactionsUpdated: cardResult.count,
        paymentRecordsUpdated: csvResult.count,
      },
      "[Migration] Non-SaaS matchStatus PENDING → UNMATCHED migration completed"
    );

    return {
      success: true,
      data: {
        cardTransactionsUpdated: cardResult.count,
        paymentRecordsUpdated: csvResult.count,
      },
    };
  } catch (error) {
    logger.error({ err: error }, "[Migration] Non-SaaS migration failed");
    return {
      success: false,
      message: "An error occurred while running the migration",
    };
  }
}
