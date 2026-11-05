// src/app/api/cron/agent-reminder/route.ts
import { prisma } from "@/lib/db";
import { getUsersWithoutAgent } from "@/lib/services/fleetdm/deviceService";
import { sendAgentInstallationReminderEmail } from "@/lib/services/notification";
import { NextRequest, NextResponse } from "next/server";

interface ProcessResult {
  organizationId: string;
  organizationName: string;
  usersWithoutAgent: number;
  emailsSent: number;
  errors: string[];
}

import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { withCronAuth } from "@/lib/middleware";

export const GET = withCronAuth(
  withLogging("cron:agent-reminder", async (request: NextRequest) => {
    try {
      logger.info("[Cron] Agent install reminder processing started");

      // Fetch all organizations
      const organizations = await prisma.organization.findMany({
        select: {
          id: true,
          name: true,
        },
      });

      const results: ProcessResult[] = [];

      for (const org of organizations) {
        const result: ProcessResult = {
          organizationId: org.id,
          organizationName: org.name,
          usersWithoutAgent: 0,
          emailsSent: 0,
          errors: [],
        };

        try {
          // Fetch users without the agent installed
          const usersWithoutAgent = await getUsersWithoutAgent(org.id);
          result.usersWithoutAgent = usersWithoutAgent.length;

          // Send a reminder email to each user
          for (const user of usersWithoutAgent) {
            try {
              const emailResult = await sendAgentInstallationReminderEmail({
                to: user.email,
                userName: user.name,
                organizationName: org.name,
              });

              if (emailResult.success) {
                result.emailsSent++;
                logger.info(
                  `[Cron] Reminder sent: ${user.email} (${org.name})`
                );
              } else {
                result.errors.push(
                  `${user.email}: ${emailResult.error || "Send failed"}`
                );
              }
            } catch (error) {
              result.errors.push(
                `${user.email}: ${error instanceof Error ? error.message : "Unknown error"}`
              );
            }
          }
        } catch (error) {
          result.errors.push(
            `Organization processing error: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }

        results.push(result);
      }

      // Summary log
      const summary = {
        totalOrganizations: results.length,
        totalUsersWithoutAgent: results.reduce(
          (sum, r) => sum + r.usersWithoutAgent,
          0
        ),
        totalEmailsSent: results.reduce((sum, r) => sum + r.emailsSent, 0),
        totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      };

      logger.info(
        { summary },
        "[Cron] Agent install reminder processing completed"
      );

      return NextResponse.json({
        success: true,
        summary,
        results,
      });
    } catch (error) {
      logger.error(
        { err: error },
        "[Cron] Agent install reminder processing error"
      );

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
