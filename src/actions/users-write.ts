// src/actions/users-write.ts
"use server";

/**
 * User update/delete Server Actions
 */

import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import type { ActionState } from "@/types";
import type { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { isLastAdmin } from "./users-utils";
import { updateUserSchema } from "./users.types";

/**
 * Update user details
 */
async function _updateUser(
  id: string,
  _prevState: ActionState<{ id: string }>,
  formData: FormData
): Promise<ActionState<{ id: string }>> {
  const { organizationId, userId } = await requireOrganization();

  // Check if user exists and belongs to organization
  const existingUser = await prisma.user.findFirst({
    where: {
      id,
      organizationId,
    },
  });

  if (!existingUser) {
    return { success: false, message: "User not found" };
  }

  // Parse and validate form data
  const rawData = {
    name: formData.get("name") as string | null,
    role: formData.get("role") as string | null,
    status: formData.get("status") as string | null,
    department: formData.get("department") as string | null,
    jobTitle: formData.get("jobTitle") as string | null,
    employeeId: formData.get("employeeId") as string | null,
  };

  // Filter out null/empty values
  const dataToValidate = Object.fromEntries(
    Object.entries(rawData).filter(([, v]) => v !== null && v !== "")
  );

  const validationResult = updateUserSchema.safeParse(dataToValidate);

  if (!validationResult.success) {
    return {
      success: false,
      message: "The input data is invalid",
      errors: validationResult.error.flatten().fieldErrors,
    };
  }

  try {
    // Build update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (rawData.name) updateData.name = rawData.name;
    if (rawData.role) updateData.role = rawData.role;
    if (rawData.status) {
      updateData.status = rawData.status;
      if (rawData.status === "TERMINATED") {
        updateData.terminatedAt = new Date();
      } else {
        updateData.terminatedAt = null;
      }
    }
    if (rawData.department !== null)
      updateData.department = rawData.department || null;
    if (rawData.jobTitle !== null)
      updateData.jobTitle = rawData.jobTitle || null;
    if (rawData.employeeId !== null)
      updateData.employeeId = rawData.employeeId || null;

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: "UPDATE_USER",
        entityType: "User",
        entityId: updated.id,
        userId,
        organizationId,
        metadata: {
          email: updated.email,
          updatedFields: Object.keys(updateData),
        },
      },
    });

    revalidatePath("/users");
    revalidatePath(`/users/${id}`);

    return {
      success: true,
      message: "User details updated",
      data: { id: updated.id },
    };
  } catch (error) {
    logger.error({ err: error }, "Failed to update user");
    return { success: false, message: "Failed to update the user" };
  }
}
export const updateUser = withLogging("updateUser", _updateUser);

/**
 * Revoke a user's access to a specific app
 */
async function _revokeUserAppAccess(
  userIdToRevoke: string,
  appId: string
): Promise<ActionState> {
  const { organizationId, userId } = await requireOrganization();

  // Find user with app access
  const user = await prisma.user.findFirst({
    where: {
      id: userIdToRevoke,
      organizationId,
    },
    include: {
      appAccesses: {
        where: { appId },
        include: { app: true },
      },
    },
  });

  if (!user) {
    return { success: false, message: "User not found" };
  }

  const access = user.appAccesses[0];
  if (!access) {
    return { success: false, message: "Access grant not found" };
  }

  try {
    // Fetch SubscriptionUser rows assigned to that app's subscriptions
    const affectedSubscriptionUsers = await prisma.subscriptionUser.findMany({
      where: {
        userId: userIdToRevoke,
        subscription: { appId },
      },
      select: { id: true, subscriptionId: true },
    });
    const affectedSubscriptionIds = affectedSubscriptionUsers.map(
      (su) => su.subscriptionId
    );

    // Delete UserAppAccess + delete SubscriptionUser + recalculate usedLicenses
    await prisma.$transaction(async (tx) => {
      await tx.userAppAccess.delete({
        where: { id: access.id },
      });

      if (affectedSubscriptionUsers.length > 0) {
        await tx.subscriptionUser.deleteMany({
          where: {
            userId: userIdToRevoke,
            subscription: { appId },
          },
        });

        for (const subscriptionId of affectedSubscriptionIds) {
          const count = await tx.subscriptionUser.count({
            where: { subscriptionId },
          });
          await tx.subscription.update({
            where: { id: subscriptionId },
            data: { usedLicenses: count },
          });
        }
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: "REVOKE_ACCESS",
        entityType: "UserAppAccess",
        entityId: access.id,
        userId,
        organizationId,
        metadata: { userEmail: user.email, appId, appName: access.app.name },
      },
    });

    revalidatePath("/users");
    revalidatePath(`/users/${userIdToRevoke}`);
    revalidatePath("/users/offboarded");
    revalidatePath("/subscriptions");
    for (const subscriptionId of affectedSubscriptionIds) {
      revalidatePath(`/subscriptions/${subscriptionId}`);
    }

    return {
      success: true,
      message: `Access to ${access.app.name} has been revoked`,
    };
  } catch (error) {
    logger.error({ err: error }, "Failed to revoke access");
    return { success: false, message: "Failed to revoke access" };
  }
}
export const revokeUserAppAccess = withLogging(
  "revokeUserAppAccess",
  _revokeUserAppAccess
);

/**
 * Revoke all of a user's app access
 */
async function _revokeAllUserAppAccess(
  userIdToRevoke: string
): Promise<ActionState> {
  const { organizationId, userId } = await requireOrganization();

  // Find user with both appAccesses and subscriptionAssignments
  const user = await prisma.user.findFirst({
    where: {
      id: userIdToRevoke,
      organizationId,
    },
    include: {
      appAccesses: true,
      subscriptionAssignments: true,
    },
  });

  if (!user) {
    return { success: false, message: "User not found" };
  }

  const appAccessCount = user.appAccesses.length;
  const subscriptionAssignmentCount = user.subscriptionAssignments.length;

  if (appAccessCount + subscriptionAssignmentCount === 0) {
    return { success: false, message: "There is no access to revoke" };
  }

  try {
    // Collect affected subscription IDs before deletion
    const affectedSubscriptionIds = user.subscriptionAssignments.map(
      (sa) => sa.subscriptionId
    );

    // Interactive transaction: recalculate usedLicenses after deletion
    const {
      appAccessCount: revokedAppAccessCount,
      subscriptionCount: revokedSubscriptionCount,
    } = await prisma.$transaction(async (tx) => {
      const appAccessResult = await tx.userAppAccess.deleteMany({
        where: { userId: userIdToRevoke },
      });

      const subscriptionResult = await tx.subscriptionUser.deleteMany({
        where: { userId: userIdToRevoke },
      });

      // Recalculate usedLicenses of affected subscriptions
      for (const subscriptionId of affectedSubscriptionIds) {
        const count = await tx.subscriptionUser.count({
          where: { subscriptionId },
        });
        await tx.subscription.update({
          where: { id: subscriptionId },
          data: { usedLicenses: count },
        });
      }

      return {
        appAccessCount: appAccessResult.count,
        subscriptionCount: subscriptionResult.count,
      };
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: "REVOKE_ALL_ACCESS",
        entityType: "UserAppAccess",
        entityId: userIdToRevoke,
        userId,
        organizationId,
        metadata: {
          userEmail: user.email,
          revokedAppAccessCount,
          revokedSubscriptionAssignmentCount: revokedSubscriptionCount,
          revokedCount: revokedAppAccessCount + revokedSubscriptionCount,
        },
      },
    });

    const totalRevoked = revokedAppAccessCount + revokedSubscriptionCount;

    revalidatePath("/users");
    revalidatePath(`/users/${userIdToRevoke}`);
    revalidatePath("/users/offboarded");
    revalidatePath("/subscriptions");
    for (const subscriptionId of affectedSubscriptionIds) {
      revalidatePath(`/subscriptions/${subscriptionId}`);
    }

    return {
      success: true,
      message: `Revoked ${totalRevoked} access grant(s)`,
    };
  } catch (error) {
    logger.error({ err: error }, "Failed to revoke all access");
    return { success: false, message: "Failed to revoke access" };
  }
}
export const revokeAllUserAppAccess = withLogging(
  "revokeAllUserAppAccess",
  _revokeAllUserAppAccess
);

/**
 * Transfer the Admin role
 * The current ADMIN transfers the ADMIN role to the target and switches to newSelfRole
 */
async function _transferAdminRole(
  targetUserId: string,
  newSelfRole: Exclude<UserRole, "ADMIN">
): Promise<ActionState> {
  const { organizationId, userId, role } = await requireOrganization();

  if (role !== "ADMIN") {
    return { success: false, message: "Only admins can transfer admin rights" };
  }

  if (targetUserId === userId) {
    return { success: false, message: "You cannot transfer to yourself" };
  }

  const targetUser = await prisma.user.findFirst({
    where: {
      id: targetUserId,
      organizationId,
    },
  });

  if (!targetUser) {
    return { success: false, message: "Target user not found" };
  }

  if (targetUser.status !== "ACTIVE") {
    return {
      success: false,
      message: "Admin rights can only be transferred to an active user",
    };
  }

  if (targetUser.role === "ADMIN") {
    return {
      success: false,
      message: "The target user is already an admin",
    };
  }

  const lastAdmin = await isLastAdmin(organizationId, userId);
  if (lastAdmin) {
    logger.info(
      { userId, targetUserId, organizationId },
      "Last admin transferring role"
    );
  }

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUserId },
        data: { role: "ADMIN" },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { role: newSelfRole },
      }),
    ]);

    await prisma.auditLog.create({
      data: {
        action: "TRANSFER_ADMIN",
        entityType: "User",
        entityId: targetUserId,
        userId,
        organizationId,
        metadata: {
          fromUserId: userId,
          toUserId: targetUserId,
          toUserEmail: targetUser.email,
          newSelfRole,
        },
      },
    });

    revalidatePath("/settings/team");
    revalidatePath("/users");

    return {
      success: true,
      message: "Admin rights transferred",
    };
  } catch (error) {
    logger.error({ err: error }, "Failed to transfer admin role");
    return { success: false, message: "Failed to transfer admin rights" };
  }
}
export const transferAdminRole = withLogging(
  "transferAdminRole",
  _transferAdminRole
);

/**
 * Admin-initiated user offboarding
 * Sets the user status to TERMINATED and invalidates sessions/accounts.
 * Related data (owned apps, cards, transactions, etc.) is kept so it can be managed on the offboarded page.
 */
async function _offboardUser(targetUserId: string): Promise<ActionState> {
  const { organizationId, userId, role } = await requireOrganization();

  if (role !== "ADMIN") {
    return { success: false, message: "Only admins can offboard users" };
  }

  if (targetUserId === userId) {
    return {
      success: false,
      message: "You cannot offboard yourself.",
    };
  }

  const targetUser = await prisma.user.findFirst({
    where: {
      id: targetUserId,
      organizationId,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      department: true,
    },
  });

  if (!targetUser) {
    return { success: false, message: "User not found" };
  }

  if (targetUser.role === "ADMIN") {
    return {
      success: false,
      message:
        "Admins cannot be offboarded. Transfer the admin role to another member first.",
    };
  }

  if (targetUser.status === "TERMINATED") {
    return {
      success: false,
      message: "This user has already been offboarded.",
    };
  }

  try {
    await prisma.$transaction([
      // Set the user status to TERMINATED
      prisma.user.update({
        where: { id: targetUserId },
        data: { status: "TERMINATED", terminatedAt: new Date() },
      }),
      // Delete sessions (blocks sign-in)
      prisma.session.deleteMany({
        where: { userId: targetUserId },
      }),
      // Delete accounts (unlinks OAuth)
      prisma.account.deleteMany({
        where: { userId: targetUserId },
      }),
      // Delete invitation records (so the user can be re-invited)
      prisma.invitation.deleteMany({
        where: {
          email: targetUser.email,
          organizationId,
        },
      }),
    ]);

    // Write the audit log
    await prisma.auditLog.create({
      data: {
        action: "OFFBOARD_USER",
        entityType: "User",
        entityId: targetUserId,
        userId,
        organizationId,
        metadata: {
          offboardedUserName: targetUser.name,
          offboardedUserEmail: targetUser.email,
          offboardedUserRole: targetUser.role,
          offboardedUserDepartment: targetUser.department,
          offboardedBy: userId,
        },
      },
    });

    revalidatePath("/settings/team");
    revalidatePath("/users");
    revalidatePath("/users/offboarded");

    return {
      success: true,
      message: "The user has been offboarded",
    };
  } catch (error) {
    logger.error({ err: error }, "Failed to offboard user");
    return { success: false, message: "Failed to offboard the user" };
  }
}
export const offboardUser = withLogging("offboardUser", _offboardUser);

/**
 * Permanently delete an offboarded user
 * Only TERMINATED users. Related data is reassigned to null, then cascade-deleted.
 */
async function _permanentlyDeleteUser(
  targetUserId: string
): Promise<ActionState> {
  const { organizationId, userId, role } = await requireOrganization();

  if (role !== "ADMIN") {
    return {
      success: false,
      message: "Only admins can permanently delete users",
    };
  }

  if (targetUserId === userId) {
    return {
      success: false,
      message: "You cannot delete yourself.",
    };
  }

  const targetUser = await prisma.user.findFirst({
    where: {
      id: targetUserId,
      organizationId,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      department: true,
    },
  });

  if (!targetUser) {
    return { success: false, message: "User not found" };
  }

  if (targetUser.status !== "TERMINATED") {
    return {
      success: false,
      message:
        "Only offboarded users can be permanently deleted. Offboard the user first.",
    };
  }

  try {
    // Write the audit log (before deletion)
    await prisma.auditLog.create({
      data: {
        action: "PERMANENTLY_DELETE_USER",
        entityType: "User",
        entityId: targetUserId,
        userId,
        organizationId,
        metadata: {
          deletedUserName: targetUser.name,
          deletedUserEmail: targetUser.email,
          deletedUserRole: targetUser.role,
          deletedUserDepartment: targetUser.department,
          deletedBy: userId,
        },
      },
    });

    // Collect affected subscription IDs before deletion
    const affectedSubscriptions = await prisma.subscriptionUser.findMany({
      where: { userId: targetUserId },
      select: { subscriptionId: true },
    });
    const affectedSubscriptionIds = affectedSubscriptions.map(
      (s) => s.subscriptionId
    );

    // Reassign/release related data and delete in one interactive transaction
    await prisma.$transaction(async (tx) => {
      // Owned apps → clear owner
      await tx.app.updateMany({
        where: { ownerId: targetUserId },
        data: { ownerId: null },
      });
      // Assigned cards → clear assignee
      await tx.corporateCard.updateMany({
        where: { assignedUserId: targetUserId },
        data: { assignedUserId: null },
      });
      // Assigned transactions → clear assignee
      await tx.cardTransaction.updateMany({
        where: { userId: targetUserId },
        data: { userId: null },
      });
      // Direct reports → clear manager
      await tx.user.updateMany({
        where: { managerId: targetUserId },
        data: { managerId: null },
      });
      // Delete invitation records (so the user can be re-invited)
      await tx.invitation.deleteMany({
        where: {
          email: targetUser.email,
          organizationId,
        },
      });
      // Delete the User (cascade: accounts, sessions, appAccesses, subscriptionAssignments, etc.)
      await tx.user.delete({
        where: { id: targetUserId },
      });

      // Recalculate usedLicenses of affected subscriptions
      for (const subscriptionId of affectedSubscriptionIds) {
        const count = await tx.subscriptionUser.count({
          where: { subscriptionId },
        });
        await tx.subscription.update({
          where: { id: subscriptionId },
          data: { usedLicenses: count },
        });
      }
    });

    revalidatePath("/settings/team");
    revalidatePath("/users");
    revalidatePath("/users/offboarded");
    revalidatePath("/subscriptions");
    for (const subscriptionId of affectedSubscriptionIds) {
      revalidatePath(`/subscriptions/${subscriptionId}`);
    }

    return {
      success: true,
      message: "The user has been permanently deleted",
    };
  } catch (error) {
    logger.error({ err: error }, "Failed to permanently delete user");
    return { success: false, message: "Failed to permanently delete the user" };
  }
}
export const permanentlyDeleteUser = withLogging(
  "permanentlyDeleteUser",
  _permanentlyDeleteUser
);
