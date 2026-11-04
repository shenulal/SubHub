// src/app/api/cron/approval-reminders/route.ts
/**
 * Feature 2.6 — reminder / escalation / expiry sweep for pending approvals.
 * Scheduled in vercel.json.
 */
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { withCronAuth } from "@/lib/middleware";
import { processApprovalReminders } from "@/lib/services/approval/reminders";
import { NextResponse } from "next/server";

export const GET = withCronAuth(
  withLogging("cron:approval-reminders", async () => {
    try {
      const result = await processApprovalReminders();
      logger.info({ result }, "[Cron] approval reminders processed");
      return NextResponse.json({ success: true, ...result });
    } catch (error) {
      logger.error({ err: error }, "[Cron] approval reminders failed");
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
