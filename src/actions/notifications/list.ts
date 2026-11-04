// src/actions/notifications/list.ts
"use server";

import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import {
  getUnreadCountFor,
  listNotificationsFor,
  markAllReadFor,
  markReadFor,
} from "@/lib/services/notification/inbox";
import {
  listNotificationsSchema,
  markReadSchema,
  type ListNotificationsInput,
} from "@/lib/validations/notifications";
import type { ActionState } from "@/types";
import type { NotificationListPage } from "@/types/notification";
import { revalidatePath } from "next/cache";
import { toActionError } from "./shared";

const NOTIFICATIONS_PATH = "/notifications";

async function _listNotifications(
  input: ListNotificationsInput = {}
): Promise<ActionState<NotificationListPage>> {
  try {
    const { userId, organizationId } =
      await requirePermission("notifications:read");
    const params = listNotificationsSchema.parse(input);
    const data = await listNotificationsFor({ organizationId, userId }, params);
    return { success: true, data };
  } catch (error) {
    return toActionError(error, "listNotifications");
  }
}
export const listNotifications = withLogging(
  "listNotifications",
  _listNotifications
);

async function _getUnreadCount(): Promise<ActionState<number>> {
  try {
    const { userId, organizationId } =
      await requirePermission("notifications:read");
    const data = await getUnreadCountFor({ organizationId, userId });
    return { success: true, data };
  } catch (error) {
    return toActionError(error, "getUnreadCount");
  }
}
export const getUnreadCount = withLogging("getUnreadCount", _getUnreadCount);

async function _markRead(ids: string[]): Promise<ActionState<number>> {
  try {
    const { userId, organizationId } =
      await requirePermission("notifications:read");
    const parsed = markReadSchema.parse({ ids });
    const count =
      "ids" in parsed
        ? await markReadFor({ organizationId, userId }, parsed.ids)
        : 0;
    revalidatePath(NOTIFICATIONS_PATH);
    return { success: true, data: count };
  } catch (error) {
    return toActionError(error, "markRead");
  }
}
export const markRead = withLogging("markRead", _markRead);

async function _markAllRead(): Promise<ActionState<number>> {
  try {
    const { userId, organizationId } =
      await requirePermission("notifications:read");
    const count = await markAllReadFor({ organizationId, userId });
    revalidatePath(NOTIFICATIONS_PATH);
    return { success: true, data: count };
  } catch (error) {
    return toActionError(error, "markAllRead");
  }
}
export const markAllRead = withLogging("markAllRead", _markAllRead);
