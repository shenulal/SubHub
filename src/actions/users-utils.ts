// src/actions/users-utils.ts
"use server";

/**
 * Shared user utility functions
 */

import { prisma } from "@/lib/db";

/**
 * Check whether the user is the organization's last ADMIN
 */
export async function isLastAdmin(
  organizationId: string,
  userId: string
): Promise<boolean> {
  const adminCount = await prisma.user.count({
    where: {
      organizationId,
      role: "ADMIN",
      id: { not: userId },
    },
  });

  return adminCount === 0;
}

/**
 * Count data linked to a user (for the delete confirmation dialog)
 */
export async function getUserRelatedDataCounts(userId: string): Promise<{
  ownedApps: number;
  assignedCorporateCards: number;
  assignedCardTransactions: number;
  directReports: number;
  assignedSubscriptions: number;
}> {
  const [
    ownedApps,
    assignedCorporateCards,
    assignedCardTransactions,
    directReports,
    assignedSubscriptions,
  ] = await Promise.all([
    prisma.app.count({ where: { ownerId: userId } }),
    prisma.corporateCard.count({ where: { assignedUserId: userId } }),
    prisma.cardTransaction.count({ where: { userId } }),
    prisma.user.count({ where: { managerId: userId } }),
    prisma.subscriptionUser.count({ where: { userId } }),
  ]);

  return {
    ownedApps,
    assignedCorporateCards,
    assignedCardTransactions,
    directReports,
    assignedSubscriptions,
  };
}
