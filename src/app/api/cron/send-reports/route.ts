// src/app/api/cron/send-reports/route.ts
/**
 * Scheduled report delivery cron job
 * Runs hourly via Vercel Cron
 */

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { withCronAuth } from "@/lib/middleware";
import { sendReportEmail } from "@/lib/services/report/email-sender";
import { NextRequest, NextResponse } from "next/server";

export const GET = withCronAuth(
  withLogging("cron:send-reports", async (request: NextRequest) => {
    const now = new Date();
    // Idempotency: prevent duplicate runs within 1 hour
    const idempotencyWindow = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

    const results: {
      id: string;
      status: "success" | "error" | "skipped";
      error?: string;
    }[] = [];

    try {
      // Fetch due schedules (with idempotency check)
      const dueSchedules = await prisma.reportSchedule.findMany({
        where: {
          isActive: true,
          nextSendAt: {
            lte: now,
          },
          // Idempotency: exclude schedules already sent within the last hour
          OR: [{ lastSentAt: null }, { lastSentAt: { lt: idempotencyWindow } }],
        },
        include: {
          organization: {
            select: { name: true },
          },
        },
      });

      logger.info(`Found ${dueSchedules.length} schedules to process`);

      // Process each schedule
      for (const schedule of dueSchedules) {
        try {
          // Re-check idempotency (prevents race conditions)
          const freshSchedule = await prisma.reportSchedule.findUnique({
            where: { id: schedule.id },
            select: { lastSentAt: true },
          });

          if (
            freshSchedule?.lastSentAt &&
            freshSchedule.lastSentAt >= idempotencyWindow
          ) {
            logger.info(
              `Skipping schedule ${schedule.id} - already processed recently`
            );
            results.push({ id: schedule.id, status: "skipped" });
            continue;
          }

          // Calculate the next send time (up front)
          const nextSendAt = calculateNextSendAt(schedule);

          // Update the schedule first (acts as a lock before sending)
          await prisma.reportSchedule.update({
            where: { id: schedule.id },
            data: {
              lastSentAt: now,
              nextSendAt,
            },
          });

          // Generate the report and send the email
          await sendReportEmail({
            scheduleId: schedule.id,
            organizationId: schedule.organizationId,
            organizationName: schedule.organization.name,
            reportType: schedule.reportType,
            format: schedule.format,
            recipients: schedule.recipients,
          });

          results.push({ id: schedule.id, status: "success" });
          logger.info(`Successfully sent report for schedule ${schedule.id}`);
        } catch (error) {
          logger.error(
            { err: error, scheduleId: schedule.id },
            "Failed to send report for schedule"
          );
          results.push({
            id: schedule.id,
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return NextResponse.json({
        success: true,
        processed: dueSchedules.length,
        results,
        timestamp: now.toISOString(),
      });
    } catch (error) {
      logger.error({ err: error }, "Cron job failed");
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

/**
 * Calculate the next send time
 */
function calculateNextSendAt(schedule: {
  frequency: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  hour: number;
  timezone: string;
}): Date {
  const now = new Date();
  const next = new Date(now);

  // Set the send time by default
  next.setHours(schedule.hour, 0, 0, 0);

  switch (schedule.frequency) {
    case "DAILY":
      // Next day
      next.setDate(next.getDate() + 1);
      break;

    case "WEEKLY":
      // Same weekday next week
      const daysUntilNext =
        schedule.dayOfWeek !== null
          ? (schedule.dayOfWeek - now.getDay() + 7) % 7 || 7
          : 7;
      next.setDate(next.getDate() + daysUntilNext);
      break;

    case "MONTHLY":
      // Same day next month
      next.setMonth(next.getMonth() + 1);
      if (schedule.dayOfMonth !== null) {
        const lastDay = new Date(
          next.getFullYear(),
          next.getMonth() + 1,
          0
        ).getDate();
        next.setDate(Math.min(schedule.dayOfMonth, lastDay));
      }
      break;

    default:
      // Default: next week
      next.setDate(next.getDate() + 7);
  }

  return next;
}
