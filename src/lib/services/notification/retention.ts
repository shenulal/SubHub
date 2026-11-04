// src/lib/services/notification/retention.ts
/**
 * Inbox retention: drop rows older than `privacy.notificationRetentionDays`
 * and keep at most `notifications.maxInAppItems` per member.
 */
import { prisma } from "@/lib/db";

const MS_PER_DAY = 86_400_000;

export interface RetentionOptions {
  maxItems: number;
  retentionDays: number;
  now?: Date;
}

export async function trimInboxes(
  organizationId: string,
  userIds: string[],
  options: RetentionOptions
): Promise<{ deleted: number }> {
  if (userIds.length === 0) return { deleted: 0 };
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - options.retentionDays * MS_PER_DAY);

  const aged = await prisma.notification.deleteMany({
    where: {
      organizationId,
      userId: { in: userIds },
      createdAt: { lt: cutoff },
    },
  });

  let overflow = 0;
  for (const userId of userIds) {
    const extra = await prisma.notification.findMany({
      where: { organizationId, userId },
      orderBy: { createdAt: "desc" },
      skip: options.maxItems,
      select: { id: true },
    });
    if (extra.length === 0) continue;
    const res = await prisma.notification.deleteMany({
      where: { id: { in: extra.map((e) => e.id) } },
    });
    overflow += res.count;
  }
  return { deleted: aged.count + overflow };
}
