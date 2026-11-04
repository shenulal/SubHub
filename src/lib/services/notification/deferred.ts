// src/lib/services/notification/deferred.ts
/**
 * Releases email/push that `notify()` held during quiet hours.
 * Rows carry `metadata.deferredUntil` (epoch ms) plus the payload to send.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { Prisma } from "@prisma/client";
import { sendNotifyEmails, type NotifyEmailContent } from "./center-email";
import { sendNotifyPush, type NotifyPushContent } from "./center-push";

const BATCH_SIZE = 200;

export interface DeferredResult {
  processed: number;
  emailsSent: number;
  pushSent: number;
}

type DeferredMeta = {
  deferredUntil?: number;
  deferredEmail?: NotifyEmailContent;
  deferredPush?: NotifyPushContent;
} & Record<string, unknown>;

function stripDeferral(meta: DeferredMeta): Prisma.InputJsonValue {
  const rest = { ...meta };
  delete rest.deferredUntil;
  delete rest.deferredEmail;
  delete rest.deferredPush;
  return rest as Prisma.InputJsonValue;
}

export async function processDeferredNotifications(
  now: Date = new Date()
): Promise<DeferredResult> {
  const rows = await prisma.notification.findMany({
    where: {
      metadata: { path: ["deferredUntil"], lte: now.getTime() },
    },
    select: {
      id: true,
      organizationId: true,
      userId: true,
      type: true,
      metadata: true,
    },
    take: BATCH_SIZE,
  });

  const result: DeferredResult = { processed: 0, emailsSent: 0, pushSent: 0 };
  for (const row of rows) {
    const meta = (row.metadata ?? {}) as DeferredMeta;
    try {
      if (meta.deferredEmail) {
        const user = await prisma.user.findUnique({
          where: { id: row.userId },
          select: { email: true, status: true },
        });
        if (user?.status === "ACTIVE") {
          result.emailsSent += await sendNotifyEmails(
            row.organizationId,
            [{ email: user.email, content: meta.deferredEmail }],
            row.type
          );
        }
      }
      if (meta.deferredPush) {
        result.pushSent += await sendNotifyPush(
          [row.userId],
          meta.deferredPush,
          row.type
        );
      }
      await prisma.notification.update({
        where: { id: row.id },
        data: { metadata: stripDeferral(meta) },
      });
      result.processed++;
    } catch (error) {
      logger.warn({ err: error, id: row.id }, "[notify] deferred send failed");
    }
  }
  return result;
}
