// src/app/api/cron/subscription-reminders/route.ts
/**
 * Daily notification maintenance (vercel.json: 06:15 UTC):
 *  1. renewal reminders per subscription lead days (3.1 / 3.4)
 *  2. release email/push deferred by quiet hours
 *  3. backfill legacy computed alerts into the persistent centre (11.1)
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { withCronAuth } from "@/lib/middleware";
import { backfillComputedAlerts } from "@/lib/services/notification/backfill";
import { processDeferredNotifications } from "@/lib/services/notification/deferred";
import { processSubscriptionReminders } from "@/lib/services/notification/reminders";
import { NextResponse } from "next/server";

export const GET = withCronAuth(
  withLogging("cron:subscription-reminders", async () => {
    try {
      const reminders = await processSubscriptionReminders();
      const deferred = await processDeferredNotifications();

      const organizations = await prisma.organization.findMany({
        select: { id: true },
      });
      const backfill = {
        organizations: 0,
        created: 0,
        deduped: 0,
        errors: [] as string[],
      };
      for (const org of organizations) {
        try {
          const res = await backfillComputedAlerts(org.id);
          backfill.organizations++;
          backfill.created += res.created;
          backfill.deduped += res.deduped;
        } catch (error) {
          backfill.errors.push(
            `${org.id}: ${error instanceof Error ? error.message : "backfill failed"}`
          );
        }
      }

      logger.info(
        { reminders, deferred, backfill },
        "[Cron] subscription reminders done"
      );
      return NextResponse.json({
        success: reminders.errors.length === 0 && backfill.errors.length === 0,
        reminders,
        deferred,
        backfill,
      });
    } catch (error) {
      logger.error({ err: error }, "[Cron] subscription reminders failed");
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
