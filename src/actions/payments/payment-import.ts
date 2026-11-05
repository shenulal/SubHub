"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { parsePaymentCSV } from "@/lib/payment-csv";
import {
  type AppMatch,
  type CatalogWithPatterns,
} from "@/lib/services/payment/merchant-matcher";
import { normalizeMerchantName } from "@/lib/services/payment/merchant-matcher.utils";
import { processPaymentRecords } from "@/lib/services/payment/process-payment-records";
import {
  completeSyncHistory,
  createSyncHistory,
} from "@/lib/services/payment/sync-history-service";
import { checkNonSaaSCache } from "@/lib/services/saas-matcher";
import type { ActionState } from "@/types";
import { revalidatePath } from "next/cache";

export interface PaymentImportResult {
  imported: number;
  matched: number;
  unmatched: number;
  duplicates: number;
  batchId: string;
  errors?: Array<{
    row: number;
    message: string;
  }>;
}

/**
 * Payment CSV import options (SMP-78)
 * - teamId and userId are mutually exclusive (only one can be chosen)
 */
export interface PaymentImportOptions {
  teamId?: string;
  userId?: string;
  fileName?: string;
}

/**
 * Import a payment CSV
 */
async function _importPaymentCSV(
  csvContent: string,
  options?: PaymentImportOptions
): Promise<ActionState<PaymentImportResult>> {
  // syncHistoryId is declared outside so the error handler can access it
  let syncHistoryId: string | undefined;

  try {
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        message: "Authentication required",
      };
    }

    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }

    if (session.user.role !== "ADMIN") {
      return {
        success: false,
        message: "Only admins can import payment records",
      };
    }

    // SMP-78: validate Team/User assignment
    const { teamId, userId, fileName } = options || {};

    // Create SyncHistory (auxiliary; failure does not affect the main flow)
    try {
      const syncHistory = await createSyncHistory({
        organizationId: session.user.organizationId,
        type: "CSV_IMPORT",
        triggeredBy: "USER",
        userId: session.user.id,
        fileName,
      });
      syncHistoryId = syncHistory.id;
    } catch (syncHistoryError) {
      logger.warn(
        { err: syncHistoryError },
        "SyncHistory creation failed (ignored)"
      );
    }

    // Mutual exclusion check: error when both teamId and userId are given
    if (teamId && userId) {
      return {
        success: false,
        message: "Select either a team or a user assignment, not both",
      };
    }

    // Validate teamId
    if (teamId) {
      const team = await prisma.team.findFirst({
        where: {
          id: teamId,
          organizationId: session.user.organizationId,
        },
      });
      if (!team) {
        return {
          success: false,
          message: "Invalid team",
        };
      }
    }

    // Validate userId
    if (userId) {
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          organizationId: session.user.organizationId,
        },
      });
      if (!user) {
        return {
          success: false,
          message: "Invalid user",
        };
      }
    }

    // Parse the CSV
    const parseResult = parsePaymentCSV(csvContent);

    if (!parseResult.success || !parseResult.data) {
      return {
        success: false,
        message: parseResult.error || "Failed to parse the CSV file",
      };
    }

    if (parseResult.data.length === 0) {
      return {
        success: false,
        message: "No payment records to import",
      };
    }

    // Fetch app and catalog data for matching
    const [apps, catalogs, customPatterns] = await Promise.all([
      prisma.app.findMany({
        where: { organizationId: session.user.organizationId },
        select: { id: true, name: true, catalogId: true },
      }),
      prisma.saaSCatalog.findMany({
        include: {
          patterns: {
            select: { pattern: true, matchType: true, confidence: true },
          },
        },
      }),
      prisma.merchantPattern.findMany({
        where: {
          organizationId: session.user.organizationId,
          isActive: true,
        },
        orderBy: { priority: "desc" },
      }),
    ]);

    const appMatches: AppMatch[] = apps.map(
      (app: { id: string; name: string; catalogId: string | null }) => ({
        id: app.id,
        name: app.name,
        catalogId: app.catalogId,
      })
    );

    const catalogsWithPatterns: CatalogWithPatterns[] = catalogs.map(
      (cat: {
        id: string;
        name: string;
        slug: string;
        patterns: Array<{
          pattern: string;
          matchType: string;
          confidence: number;
        }>;
      }) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        patterns: cat.patterns.map(
          (p: { pattern: string; matchType: string; confidence: number }) => ({
            pattern: p.pattern,
            matchType: p.matchType as
              | "EXACT"
              | "DOMAIN"
              | "SUBDOMAIN"
              | "REGEX",
            confidence: p.confidence,
          })
        ),
      })
    );

    // Generate a batch ID
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Duplicate check by approval number
    const approvalNumbers = parseResult.data
      .map((row) => row.approvalNumber)
      .filter((num): num is string => !!num);

    const existingApprovals = await prisma.paymentRecord.findMany({
      where: {
        organizationId: session.user.organizationId,
        approvalNumber: { in: approvalNumbers },
      },
      select: { approvalNumber: true },
    });

    const existingSet = new Set(
      existingApprovals.map((r) => r.approvalNumber).filter(Boolean)
    );

    // Process only non-duplicate data
    const newRows = parseResult.data.filter(
      (row) => !row.approvalNumber || !existingSet.has(row.approvalNumber)
    );
    const duplicateCount = parseResult.data.length - newRows.length;

    if (newRows.length === 0) {
      return {
        success: true,
        message: `All payment records are already registered (${duplicateCount} duplicates)`,
        data: {
          imported: 0,
          matched: 0,
          unmatched: 0,
          duplicates: duplicateCount,
          batchId,
        },
      };
    }

    // Fetch the Non-SaaS cache (LLM call optimization)
    const normalizedNames = newRows.map((r) =>
      normalizeMerchantName(r.merchantName)
    );
    const nonSaaSSet = await checkNonSaaSCache(
      session.user.organizationId,
      normalizedNames
    );

    // Process and match payment records (shared function)
    const { paymentRecords, matchedCount } = await processPaymentRecords({
      newRows,
      appMatches,
      catalogsWithPatterns,
      customPatterns,
      organizationId: session.user.organizationId!,
      teamId: teamId || undefined,
      userId: userId || undefined,
      nonSaaSSet,
      batchId,
    });

    // Save to the DB
    const result = await prisma.paymentRecord.createMany({
      data: paymentRecords as never[],
    });

    revalidatePath("/payments");

    const message =
      duplicateCount > 0
        ? `Imported ${result.count} payment records (${duplicateCount} duplicates skipped)`
        : `Imported ${result.count} payment records`;

    // Complete SyncHistory (auxiliary)
    try {
      if (syncHistoryId) {
        await completeSyncHistory(syncHistoryId, {
          status: "SUCCESS",
          totalRecords: result.count,
          successCount: result.count,
          failedCount: 0,
          matchedCount,
          unmatchedCount: result.count - matchedCount,
        });
      }
    } catch (syncHistoryError) {
      logger.warn(
        { err: syncHistoryError },
        "SyncHistory completion update failed (ignored)"
      );
    }

    return {
      success: true,
      message,
      data: {
        imported: result.count,
        matched: matchedCount,
        unmatched: result.count - matchedCount,
        duplicates: duplicateCount,
        batchId,
        errors: parseResult.errors?.map((e) => ({
          row: e.row,
          message: e.message,
        })),
      },
    };
  } catch (error) {
    logger.error({ err: error }, "Payment import error");

    // Fail SyncHistory (auxiliary)
    try {
      if (syncHistoryId) {
        await completeSyncHistory(syncHistoryId, {
          status: "FAILED",
          totalRecords: 0,
          successCount: 0,
          failedCount: 0,
          matchedCount: 0,
          unmatchedCount: 0,
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
        });
      }
    } catch (syncHistoryError) {
      logger.warn(
        { err: syncHistoryError },
        "SyncHistory failure update error (ignored)"
      );
    }

    return {
      success: false,
      message: "An error occurred while importing payment records",
    };
  }
}
export const importPaymentCSV = withLogging(
  "importPaymentCSV",
  _importPaymentCSV
);
