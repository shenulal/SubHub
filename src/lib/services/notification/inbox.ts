// src/lib/services/notification/inbox.ts
/**
 * Read side of the notification centre (shared by server actions and REST).
 * Every query is scoped to (organizationId, userId).
 */
import { prisma } from "@/lib/db";
import { LIST_PAGE_SIZE_DEFAULT } from "@/lib/validations/notifications";
import type {
  NotificationItem,
  NotificationListPage,
  NotificationListParams,
} from "@/types/notification";
import type { Notification, Prisma } from "@prisma/client";

export interface InboxScope {
  organizationId: string;
  userId: string;
}

export function toNotificationItem(row: Notification): NotificationItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    metadata:
      row.metadata &&
      typeof row.metadata === "object" &&
      !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
  };
}

function buildWhere(
  scope: InboxScope,
  params: NotificationListParams
): Prisma.NotificationWhereInput {
  return {
    organizationId: scope.organizationId,
    userId: scope.userId,
    ...(params.unreadOnly ? { readAt: null } : {}),
    ...(params.types && params.types.length > 0
      ? { type: { in: params.types } }
      : {}),
  };
}

export async function getUnreadCountFor(scope: InboxScope): Promise<number> {
  return prisma.notification.count({
    where: {
      organizationId: scope.organizationId,
      userId: scope.userId,
      readAt: null,
    },
  });
}

/** Cursor pagination on (createdAt desc, id desc) using the row id as cursor. */
export async function listNotificationsFor(
  scope: InboxScope,
  params: NotificationListParams = {}
): Promise<NotificationListPage> {
  const limit = params.limit ?? LIST_PAGE_SIZE_DEFAULT;
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: buildWhere(scope, params),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    }),
    getUnreadCountFor(scope),
  ]);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: page.map(toNotificationItem),
    nextCursor: hasMore ? page[page.length - 1].id : null,
    unreadCount,
  };
}

export async function markReadFor(
  scope: InboxScope,
  ids: string[],
  now: Date = new Date()
): Promise<number> {
  if (ids.length === 0) return 0;
  const res = await prisma.notification.updateMany({
    where: {
      id: { in: ids },
      organizationId: scope.organizationId,
      userId: scope.userId,
      readAt: null,
    },
    data: { readAt: now },
  });
  return res.count;
}

export async function markAllReadFor(
  scope: InboxScope,
  now: Date = new Date()
): Promise<number> {
  const res = await prisma.notification.updateMany({
    where: {
      organizationId: scope.organizationId,
      userId: scope.userId,
      readAt: null,
    },
    data: { readAt: now },
  });
  return res.count;
}
