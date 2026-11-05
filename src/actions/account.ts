// src/actions/account.ts
"use server";

/**
 * Account Server Actions
 * - Account deletion
 */

import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import type { ActionState } from "@/types";
import { redirect } from "next/navigation";

/**
 * Delete own account
 *
 * Constraints:
 * - Not allowed for the organization's last ADMIN
 *
 * Data handling:
 * - Cascade delete: accounts, sessions, appAccesses
 * - SetNull: ownedApps, auditLogs, invitations, schedules, devices, directReports
 */
async function _deleteAccount(): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }

  const userId = session.user.id;
  const organizationId = session.user.organizationId;

  // Check whether the user is the organization's last ADMIN
  if (organizationId && session.user.role === "ADMIN") {
    const otherAdminCount = await prisma.user.count({
      where: {
        organizationId,
        role: "ADMIN",
        id: { not: userId },
      },
    });

    if (otherAdminCount === 0) {
      return {
        success: false,
        error:
          "The last admin of an organization cannot delete their account. Assign another admin and try again.",
      };
    }
  }

  // Fetch user info before deletion (for the audit log)
  const userToDelete = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      role: true,
      department: true,
    },
  });

  // Write the audit log (before deletion, preserving user info)
  if (organizationId) {
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: "DELETE",
        entityType: "User",
        entityId: userId,
        metadata: {
          reason: "self_deletion",
          // Preserve the deleted user's info (still viewable after userId is SetNull)
          deletedUserName: userToDelete?.name,
          deletedUserEmail: userToDelete?.email,
          deletedUserRole: userToDelete?.role,
          deletedUserDepartment: userToDelete?.department,
        },
      },
    });

    // Delete invitation records (so the user can be re-invited)
    if (userToDelete?.email) {
      await prisma.invitation.deleteMany({
        where: {
          email: userToDelete.email,
          organizationId,
        },
      });
    }
  }

  // Delete the User (Cascade/SetNull handled automatically)
  await prisma.user.delete({
    where: { id: userId },
  });

  // Invalidate the session
  await signOut({ redirect: false });

  // Redirect to the login page
  redirect("/login?deleted=true");
}
export const deleteAccount = withLogging("deleteAccount", _deleteAccount);
