// src/actions/notification-settings.ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import type { ActionState } from "@/types";
import { revalidatePath } from "next/cache";

export type NotificationField =
  | "renewalAlert30"
  | "renewalAlert60"
  | "renewalAlert90";

async function _updateNotificationSettings(
  subscriptionId: string,
  field: NotificationField,
  value: boolean
): Promise<ActionState> {
  try {
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        message: "Authentication required",
      };
    }

    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }

    // Verify the subscription exists and belongs to the organization
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        organizationId: session.user.organizationId,
      },
    });

    if (!subscription) {
      return {
        success: false,
        message: "Subscription not found",
      };
    }

    // Update notification settings
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { [field]: value },
    });

    revalidatePath(`/subscriptions/${subscriptionId}`);

    return {
      success: true,
      message: "Notification settings updated",
    };
  } catch (error) {
    logger.error({ err: error }, "Notification settings update error");
    return {
      success: false,
      message: "An error occurred while updating notification settings",
    };
  }
}
export const updateNotificationSettings = withLogging(
  "updateNotificationSettings",
  _updateNotificationSettings
);
