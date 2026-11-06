// src/actions/team-members.ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { can } from "@/lib/rbac/service";
import type { ActionState } from "@/types";
import type { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

export interface UpdateMemberRoleInput {
  userId: string;
  role: UserRole;
}

export interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  status: string;
  image: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

// Change a team member's role
async function _updateMemberRole(
  input: UpdateMemberRoleInput
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

    // Check admin permission
    if (!(await can("members:manage"))) {
      return {
        success: false,
        message: "Only admins can change roles",
      };
    }

    // Users cannot change their own role
    if (input.userId === session.user.id) {
      return {
        success: false,
        message: "You cannot change your own role",
      };
    }

    // Look up the target user
    const targetUser = await prisma.user.findFirst({
      where: {
        id: input.userId,
        organizationId: session.user.organizationId,
      },
    });

    if (!targetUser) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    // Update the role
    await prisma.user.update({
      where: { id: input.userId },
      data: { role: input.role },
    });

    revalidatePath("/settings/team");

    return {
      success: true,
      message: "Role updated",
    };
  } catch (error) {
    logger.error({ err: error }, "Role change error");
    return {
      success: false,
      message: "An error occurred while changing the role",
    };
  }
}
export const updateMemberRole = withLogging(
  "updateMemberRole",
  _updateMemberRole
);

// Remove a team member
async function _removeMember(userId: string): Promise<ActionState> {
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

    // Check admin permission
    if (!(await can("members:manage"))) {
      return {
        success: false,
        message: "Only admins can remove team members",
      };
    }

    // Users cannot remove themselves
    if (userId === session.user.id) {
      return {
        success: false,
        message: "You cannot remove yourself",
      };
    }

    // Look up the target user
    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: session.user.organizationId,
      },
    });

    if (!targetUser) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    // Check whether this is the last admin
    if (targetUser.role === "ADMIN") {
      const adminCount = await prisma.user.count({
        where: {
          organizationId: session.user.organizationId,
          role: "ADMIN",
        },
      });

      if (adminCount <= 1) {
        return {
          success: false,
          message: "The organization's last admin cannot be removed",
        };
      }
    }

    // Remove from the organization (set organizationId to null)
    await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId: null,
        role: "VIEWER", // reset to the default role
      },
    });

    revalidatePath("/settings/team");

    return {
      success: true,
      message: "Team member removed",
    };
  } catch (error) {
    logger.error({ err: error }, "Team member removal error");
    return {
      success: false,
      message: "An error occurred while removing the team member",
    };
  }
}
export const removeMember = withLogging("removeMember", _removeMember);

// List team members
export async function getTeamMembers(): Promise<ActionState<TeamMember[]>> {
  try {
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        message: "Authentication required",
      };
    }
    if (!(await can("members:read"))) {
      return {
        success: false,
        message: "You do not have permission to perform this action",
      };
    }

    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }

    const members = await prisma.user.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        image: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return {
      success: true,
      data: members,
    };
  } catch (error) {
    logger.error({ err: error }, "Team member list error");
    return {
      success: false,
      message: "An error occurred while loading team members",
    };
  }
}
