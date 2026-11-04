// src/lib/services/notification/center-push.ts
/**
 * Push leg of `notify()`: loads device tokens for the recipients and hands
 * them to the configured `PushProvider`. Invalid tokens are pruned.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { NotificationEventType } from "@prisma/client";
import { getPushProvider, type PushTarget } from "./push/provider";

export interface NotifyPushContent {
  title: string;
  body?: string;
  link?: string;
}

/** Returns number of push messages the provider reported as sent. */
export async function sendNotifyPush(
  userIds: string[],
  content: NotifyPushContent,
  type: NotificationEventType
): Promise<number> {
  if (userIds.length === 0) return 0;
  const tokens = await prisma.deviceToken.findMany({
    where: { userId: { in: userIds } },
    select: { token: true, platform: true },
  });
  if (tokens.length === 0) return 0;

  const targets: PushTarget[] = tokens.map((t) => ({
    token: t.token,
    platform: t.platform,
  }));
  const provider = getPushProvider();
  const result = await provider.send(targets, {
    title: content.title,
    body: content.body,
    link: content.link,
    data: { type },
  });

  if (result.invalidTokens.length > 0) {
    try {
      await prisma.deviceToken.deleteMany({
        where: { token: { in: result.invalidTokens } },
      });
    } catch (error) {
      logger.warn({ err: error }, "[notify] invalid token cleanup failed");
    }
  }
  return result.sent;
}
