// src/app/api/cron/sync-erp/route.ts
// DA-99: CRON sync of ERP payment data

import { decryptJson } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withCronAuth } from "@/lib/middleware";
import {
  getERPAdapter,
  isERPIntegrationType,
  type ERPCredentials,
} from "@/lib/services/erp";
import { NextResponse } from "next/server";

const MAX_DURATION_MS = 55_000; // Platform timeout guard (e.g. Vercel/Railway 60s)

export const GET = withCronAuth(async () => {
  const startTime = Date.now();
  logger.info("[sync-erp] CRON started");

  // Fetch active ERP integrations
  const integrations = await prisma.integration.findMany({
    where: {
      type: { in: ["SAP_S4HANA", "ORACLE_ERP_CLOUD"] },
      status: "ACTIVE",
    },
  });

  if (integrations.length === 0) {
    logger.info("[sync-erp] No active ERP integrations");
    return NextResponse.json({
      message: "No active ERP integrations",
      synced: 0,
    });
  }

  const results: Array<{
    integrationId: string;
    type: string;
    success: boolean;
    itemCount: number;
    error?: string;
  }> = [];

  for (const integration of integrations) {
    // Timeout guard
    if (Date.now() - startTime > MAX_DURATION_MS) {
      logger.warn(
        "[sync-erp] Time limit exceeded; skipping remaining integrations"
      );
      break;
    }

    if (!isERPIntegrationType(integration.type)) continue;

    const adapter = getERPAdapter(integration.type);
    if (!adapter) continue;

    const syncStartTime = new Date();

    try {
      // Decrypt credentials
      const creds = integration.credentials as { encrypted?: string };
      if (!creds?.encrypted) {
        logger.warn(`[sync-erp] ${integration.id}: no encrypted credentials`);
        results.push({
          integrationId: integration.id,
          type: integration.type,
          success: false,
          itemCount: 0,
          error: "No encrypted credentials",
        });
        continue;
      }

      const erpCredentials = decryptJson<ERPCredentials>(creds.encrypted);

      // Sync the last 7 days of data (assumes the CRON runs daily)
      const now = new Date();
      const fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const syncResult = await adapter.fetchPayments(erpCredentials, {
        fromDate,
        toDate: now,
      });

      // Batch-create PaymentRecords (duplicates filtered up front)
      let created = 0;
      if (syncResult.success && syncResult.items.length > 0) {
        const organizationId = integration.organizationId;
        const batchId = `erp-sync-${integration.id}-${now.toISOString().split("T")[0]}`;

        // 1. Batch-check duplicates for items that have a documentNumber
        const docNumbers = syncResult.items
          .map((item) => item.documentNumber)
          .filter((dn): dn is string => !!dn);

        const existingDocs = new Set<string>();
        if (docNumbers.length > 0) {
          const existingRecords = await prisma.paymentRecord.findMany({
            where: {
              organizationId,
              importBatchId: { startsWith: "erp-sync-" },
              rawData: {
                path: ["documentNumber"],
                string_contains: "", // non-null check
              },
            },
            select: { rawData: true },
          });
          for (const record of existingRecords) {
            const dn = (record.rawData as Record<string, unknown>)
              ?.documentNumber;
            if (typeof dn === "string") existingDocs.add(dn);
          }
        }

        // 2. Keep only new, non-duplicate items
        const newItems = syncResult.items.filter(
          (item) =>
            !item.documentNumber || !existingDocs.has(item.documentNumber)
        );

        // 3. Batch insert with createMany
        if (newItems.length > 0) {
          await prisma.paymentRecord.createMany({
            data: newItems.map((item) => ({
              organizationId,
              transactionDate: item.transactionDate,
              merchantName: item.merchantName,
              amount: item.amount,
              currency: item.currency,
              category: item.category,
              memo: item.memo,
              matchStatus: "PENDING" as const,
              importBatchId: batchId,
              rawData: item.rawData as object,
            })),
          });
          created = newItems.length;
        }
      }

      // Record the SyncLog
      await prisma.syncLog.create({
        data: {
          integrationId: integration.id,
          status: syncResult.success ? "SUCCESS" : "FAILED",
          itemsFound: syncResult.totalCount,
          itemsCreated: created,
          itemsUpdated: 0,
          errors: syncResult.errorMessage
            ? ([{ message: syncResult.errorMessage }] as object[])
            : [],
          startedAt: syncStartTime,
          completedAt: new Date(),
        },
      });

      // Update the integration status
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          lastSyncAt: new Date(),
          status: syncResult.success ? "ACTIVE" : "ERROR",
          lastError: syncResult.errorMessage || null,
        },
      });

      results.push({
        integrationId: integration.id,
        type: integration.type,
        success: syncResult.success,
        itemCount: created,
        error: syncResult.errorMessage,
      });

      logger.info(
        `[sync-erp] ${integration.type} sync completed: ${created} created`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error({ err: error }, `[sync-erp] ${integration.id} sync failed`);

      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          status: "ERROR",
          lastError: errorMessage,
        },
      });

      results.push({
        integrationId: integration.id,
        type: integration.type,
        success: false,
        itemCount: 0,
        error: errorMessage,
      });
    }

    // 500ms delay between integrations (avoids rate limits)
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const totalCreated = results.reduce((sum, r) => sum + r.itemCount, 0);
  logger.info(
    `[sync-erp] CRON completed: ${results.length} integrations, ${totalCreated} created`
  );

  return NextResponse.json({
    message: "ERP sync completed",
    synced: results.length,
    totalCreated,
    results,
  });
});
