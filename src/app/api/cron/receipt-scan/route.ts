// src/app/api/cron/receipt-scan/route.ts
/**
 * Cron: scan every due mailbox connection for receipt emails.
 * Schedule: vercel.json → /api/cron/receipt-scan (every 6 hours).
 */
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { withCronAuth } from "@/lib/middleware";
import { scanAllMailboxes } from "@/lib/services/receipts/scanner";
import { NextResponse } from "next/server";

export const GET = withCronAuth(
  withLogging("cron:receipt-scan", async () => {
    try {
      const summary = await scanAllMailboxes();
      logger.info(
        {
          scanned: summary.scanned,
          skipped: summary.skipped,
          errors: summary.errors,
        },
        "[Cron] receipt scan complete"
      );
      return NextResponse.json({
        success: true,
        processedAt: new Date().toISOString(),
        summary: {
          scanned: summary.scanned,
          skipped: summary.skipped,
          errors: summary.errors,
          created: summary.results.reduce((n, r) => n + r.created, 0),
          priceChanges: summary.results.reduce((n, r) => n + r.priceChanges, 0),
        },
        failures: summary.results
          .filter((r) => r.error)
          .map((r) => ({ connectionId: r.connectionId, error: r.error })),
      });
    } catch (error) {
      logger.error({ err: error }, "[Cron] receipt scan failed");
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  })
);
