// src/actions/subscriptions/subscription-seat-management.ts
"use server";

import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import type { ActionState } from "@/types";
import type { SeatDetails, SeatUser } from "@/types/subscription";
import { revalidatePath } from "next/cache";

const INACTIVE_DAYS_THRESHOLD = 30;

/**
 * Get seat details for a subscription
 * Cross-joins SubscriptionUser with UserAppAccess.lastUsedAt
 */
export async function getSubscriptionSeatDetails(
  subscriptionId: string
): Promise<ActionState<SeatDetails>> {
  try {
    const { organizationId } = await requireOrganization();

    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, organizationId },
      select: {
        id: true,
        appId: true,
        totalLicenses: true,
        usedLicenses: true,
      },
    });

    if (!subscription) {
      return { success: false, error: "Subscription not found" };
    }

    const totalSeats = subscription.totalLicenses ?? 0;

    // Load SubscriptionUser + User details
    const subscriptionUsers = await prisma.subscriptionUser.findMany({
      where: { subscriptionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    // Map lastUsedAt from UserAppAccess
    const userIds = subscriptionUsers.map((su) => su.userId);
    const appAccesses = await prisma.userAppAccess.findMany({
      where: {
        userId: { in: userIds },
        appId: subscription.appId,
      },
      select: {
        userId: true,
        lastUsedAt: true,
      },
    });

    const lastUsedMap = new Map(
      appAccesses.map((a) => [a.userId, a.lastUsedAt])
    );

    const now = new Date();
    const thresholdDate = new Date(now);
    thresholdDate.setDate(thresholdDate.getDate() - INACTIVE_DAYS_THRESHOLD);

    const assignedUsers: SeatUser[] = subscriptionUsers.map((su) => {
      const lastUsedAt = lastUsedMap.get(su.userId) ?? null;

      // Active status:
      // 1. lastUsedAt within 30 days → active
      // 2. lastUsedAt older than 30 days → inactive
      // 3. No UserAppAccess or lastUsedAt null → assigned, so active (fallback)
      let isInactive: boolean;
      if (lastUsedAt) {
        isInactive = lastUsedAt < thresholdDate;
      } else {
        // lastUsedAt null: no record or null → assignment fallback → active
        isInactive = false;
      }

      return {
        id: su.user.id,
        name: su.user.name,
        email: su.user.email,
        assignedAt: su.assignedAt,
        assignedBy: su.assignedBy,
        lastUsedAt,
        isInactive,
      };
    });

    const usedSeats = assignedUsers.length;
    const inactiveSeats = assignedUsers.filter((u) => u.isInactive).length;

    return {
      success: true,
      data: {
        assignedUsers,
        totalSeats,
        usedSeats,
        unassignedSeats: Math.max(0, totalSeats - usedSeats),
        inactiveSeats,
      },
    };
  } catch (error) {
    console.error("Seat detail lookup error:", error);
    return { success: false, error: "Failed to load seat details" };
  }
}

/**
 * Assign a user to a subscription
 * Validates seat capacity, creates SubscriptionUser and updates usedLicenses
 */
export async function assignUserToSubscription(
  subscriptionId: string,
  userId: string
): Promise<ActionState<{ assignedAt: Date }>> {
  try {
    const { organizationId, userId: currentUserId } =
      await requireOrganization();

    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, organizationId },
      select: {
        id: true,
        totalLicenses: true,
        _count: { select: { assignedUsers: true } },
      },
    });

    if (!subscription) {
      return { success: false, error: "Subscription not found" };
    }

    // Validate seat capacity
    if (
      subscription.totalLicenses !== null &&
      subscription._count.assignedUsers >= subscription.totalLicenses
    ) {
      return { success: false, error: "Seat limit reached" };
    }

    // Verify the user belongs to the same organization
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: { id: true, teamId: true },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Check for duplicates
    const existing = await prisma.subscriptionUser.findUnique({
      where: {
        subscriptionId_userId: { subscriptionId, userId },
      },
    });

    if (existing) {
      return { success: false, error: "User is already assigned" };
    }

    // Create SubscriptionUser + update usedLicenses (transaction)
    const result = await prisma.$transaction(async (tx) => {
      const su = await tx.subscriptionUser.create({
        data: {
          subscriptionId,
          userId,
          assignedBy: currentUserId,
        },
      });

      const count = await tx.subscriptionUser.count({
        where: { subscriptionId },
      });

      await tx.subscription.update({
        where: { id: subscriptionId },
        data: { usedLicenses: count },
      });

      return su;
    });

    // Auto-link SubscriptionTeam (when the user has a team)
    if (user.teamId) {
      const existingSubscriptionTeam = await prisma.subscriptionTeam.findFirst({
        where: { subscriptionId, teamId: user.teamId },
      });
      if (!existingSubscriptionTeam) {
        await prisma.subscriptionTeam.create({
          data: {
            subscriptionId,
            teamId: user.teamId,
            assignedBy: currentUserId,
          },
        });
      }
    }

    revalidatePath(`/subscriptions/${subscriptionId}`);

    return { success: true, data: { assignedAt: result.assignedAt } };
  } catch (error) {
    console.error("User assignment error:", error);
    return { success: false, error: "Failed to assign the user" };
  }
}

/**
 * Remove a user from a subscription
 * Deletes SubscriptionUser and decrements usedLicenses
 */
export async function removeUserFromSubscription(
  subscriptionId: string,
  userId: string
): Promise<ActionState> {
  try {
    const { organizationId } = await requireOrganization();

    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, organizationId },
      select: { id: true },
    });

    if (!subscription) {
      return { success: false, error: "Subscription not found" };
    }

    // Check the assignment
    const existing = await prisma.subscriptionUser.findUnique({
      where: {
        subscriptionId_userId: { subscriptionId, userId },
      },
    });

    if (!existing) {
      return { success: false, error: "User is not assigned" };
    }

    // Delete + update usedLicenses (transaction)
    await prisma.$transaction(async (tx) => {
      await tx.subscriptionUser.delete({
        where: {
          subscriptionId_userId: { subscriptionId, userId },
        },
      });

      const count = await tx.subscriptionUser.count({
        where: { subscriptionId },
      });

      await tx.subscription.update({
        where: { id: subscriptionId },
        data: { usedLicenses: count },
      });
    });

    revalidatePath(`/subscriptions/${subscriptionId}`);

    return { success: true };
  } catch (error) {
    console.error("User removal error:", error);
    return { success: false, error: "Failed to remove the user" };
  }
}
