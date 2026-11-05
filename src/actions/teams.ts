// src/actions/teams.ts
/**
 * Team Server Actions
 * Team management based on Google Workspace OUs
 */

"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import type { ActionState } from "@/types";
import type { Team, User } from "@prisma/client";

import { requireOrganization } from "@/lib/auth/require-auth";
import { can } from "@/lib/rbac/service";

// ==================== Types ====================

export interface TeamWithStats extends Team {
  _count: {
    members: number;
    children: number;
  };
  parent?: {
    id: string;
    name: string;
  } | null;
}

export interface TeamNode extends TeamWithStats {
  children: TeamNode[];
}

export interface TeamMember extends User {
  manager?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

// ==================== Server Actions ====================

/**
 * List teams (flat)
 */
export async function getTeams(): Promise<ActionState<TeamWithStats[]>> {
  try {
    const { organizationId } = await requireOrganization();

    const teams = await prisma.team.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: { members: true, children: true },
        },
        parent: {
          select: { id: true, name: true },
        },
      },
      orderBy: { googleOrgUnitPath: "asc" },
    });

    return { success: true, data: teams };
  } catch (error) {
    logger.error({ err: error }, "Team list error");
    if (isRedirectError(error)) throw error;
    return { success: false, message: "Failed to load teams" };
  }
}

/**
 * Get the team hierarchy (tree)
 */
export async function getTeamHierarchy(): Promise<ActionState<TeamNode[]>> {
  try {
    const { organizationId } = await requireOrganization();

    const teams = await prisma.team.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: { members: true, children: true },
        },
        parent: {
          select: { id: true, name: true },
        },
      },
      orderBy: { googleOrgUnitPath: "asc" },
    });

    // Convert to a tree
    const teamMap = new Map<string, TeamNode>();
    const rootTeams: TeamNode[] = [];

    // Pass 1: add all teams to the map
    teams.forEach((team) => {
      teamMap.set(team.id, { ...team, children: [] });
    });

    // Pass 2: set parent-child relationships
    teams.forEach((team) => {
      const node = teamMap.get(team.id)!;
      if (team.parentId) {
        const parent = teamMap.get(team.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          // No parent: treat as a root
          rootTeams.push(node);
        }
      } else {
        rootTeams.push(node);
      }
    });

    return { success: true, data: rootTeams };
  } catch (error) {
    logger.error({ err: error }, "Team hierarchy error");
    if (isRedirectError(error)) throw error;
    return { success: false, message: "Failed to load the team hierarchy" };
  }
}

/**
 * Get a single team
 */
export async function getTeam(
  teamId: string
): Promise<ActionState<TeamWithStats>> {
  try {
    const { organizationId } = await requireOrganization();

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        _count: {
          select: { members: true, children: true },
        },
        parent: {
          select: { id: true, name: true },
        },
      },
    });

    if (!team) {
      return { success: false, message: "Team not found" };
    }

    if (team.organizationId !== organizationId) {
      return { success: false, message: "You do not have access permission" };
    }

    return { success: true, data: team };
  } catch (error) {
    logger.error({ err: error }, "Team lookup error");
    if (isRedirectError(error)) throw error;
    return { success: false, message: "Failed to load the team" };
  }
}

/**
 * Get team members
 */
export async function getTeamMembers(
  teamId: string
): Promise<ActionState<TeamMember[]>> {
  try {
    const { organizationId } = await requireOrganization();

    // Check the team exists and access is allowed
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { organizationId: true },
    });

    if (!team) {
      return { success: false, message: "Team not found" };
    }

    if (team.organizationId !== organizationId) {
      return { success: false, message: "You do not have access permission" };
    }

    const members = await prisma.user.findMany({
      where: { teamId },
      include: {
        manager: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return { success: true, data: members };
  } catch (error) {
    logger.error({ err: error }, "Team member lookup error");
    if (isRedirectError(error)) throw error;
    return { success: false, message: "Failed to load team members" };
  }
}

/**
 * Create a team (manual)
 */
async function _createTeam(input: {
  name: string;
  description?: string;
  parentId?: string;
  memberIds?: string[];
}): Promise<ActionState<Team>> {
  try {
    const { organizationId } = await requireOrganization();

    if (!(await can("teams:manage"))) {
      return {
        success: false,
        message: "You do not have permission to create teams",
      };
    }

    const { name, description, parentId, memberIds } = input;

    if (!name.trim()) {
      return { success: false, message: "Please enter a team name" };
    }

    // Verify the parent team (when parentId is given)
    if (parentId) {
      const parentTeam = await prisma.team.findUnique({
        where: { id: parentId },
        select: { organizationId: true },
      });

      if (!parentTeam) {
        return { success: false, message: "Parent team not found" };
      }

      if (parentTeam.organizationId !== organizationId) {
        return { success: false, message: "You do not have access permission" };
      }
    }

    // Create the team
    const team = await prisma.team.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        parentId: parentId || null,
        organizationId,
      },
    });

    // Assign members (when memberIds is given)
    if (memberIds && memberIds.length > 0) {
      // Keep only valid members
      const validMembers = await prisma.user.findMany({
        where: {
          id: { in: memberIds },
          organizationId,
        },
        select: { id: true },
      });

      if (validMembers.length > 0) {
        await prisma.user.updateMany({
          where: {
            id: { in: validMembers.map((m) => m.id) },
          },
          data: { teamId: team.id },
        });
      }
    }

    revalidatePath("/teams");

    return { success: true, data: team, message: "Team created" };
  } catch (error) {
    logger.error({ err: error }, "Team creation error");
    if (isRedirectError(error)) throw error;
    return { success: false, message: "Failed to create the team" };
  }
}
export const createTeam = withLogging("createTeam", _createTeam);

/**
 * Team update input type
 */
export interface UpdateTeamInput {
  name?: string;
  description?: string;
  parentId?: string | null;
  memberIds?: string[]; // full member ID array (sync mode)
}

/**
 * Update a team (manually created teams only)
 * - When memberIds is given, sync team members (add/remove)
 * - Atomic via a transaction
 * - Members removed from the team are also removed from that team's subscription assignments
 */
async function _updateTeam(
  teamId: string,
  input: UpdateTeamInput
): Promise<ActionState<Team>> {
  try {
    const { organizationId, role } = await requireOrganization();

    if (role !== "ADMIN") {
      return { success: false, message: "Admin permission required" };
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { organizationId: true, googleOrgUnitId: true },
    });

    if (!team) {
      return { success: false, message: "Team not found" };
    }

    if (team.organizationId !== organizationId) {
      return { success: false, message: "You do not have access permission" };
    }

    // Teams synced from Google Workspace cannot be renamed
    if (team.googleOrgUnitId && input.name) {
      return {
        success: false,
        message: "Teams synced from Google Workspace cannot be renamed",
      };
    }

    // Verify the parent team (when parentId is given)
    if (input.parentId) {
      // Prevent a team from being its own parent
      if (input.parentId === teamId) {
        return {
          success: false,
          message: "A team cannot be its own parent",
        };
      }

      // Prevent cycles: a descendant team cannot become the parent
      const isDescendant = await checkIsDescendant(teamId, input.parentId);
      if (isDescendant) {
        return {
          success: false,
          message: "A child team cannot be set as the parent team",
        };
      }

      const parentTeam = await prisma.team.findUnique({
        where: { id: input.parentId },
        select: { organizationId: true },
      });

      if (!parentTeam) {
        return { success: false, message: "Parent team not found" };
      }

      if (parentTeam.organizationId !== organizationId) {
        return { success: false, message: "You do not have access permission" };
      }
    }

    // Apply all changes atomically in a transaction
    const updatedTeam = await prisma.$transaction(async (tx) => {
      // 1. Update basic team info
      const updated = await tx.team.update({
        where: { id: teamId },
        data: {
          ...(input.name && { name: input.name.trim() }),
          ...(input.description !== undefined && {
            description: input.description?.trim() || null,
          }),
          ...(input.parentId !== undefined && { parentId: input.parentId }),
        },
      });

      // 2. Sync members (when memberIds is given)
      if (input.memberIds !== undefined) {
        // Keep only valid members (belonging to the organization)
        const validMembers = await tx.user.findMany({
          where: {
            id: { in: input.memberIds },
            organizationId,
          },
          select: { id: true },
        });
        const validMemberIds = validMembers.map((m) => m.id);

        // Fetch current team members
        const currentMembers = await tx.user.findMany({
          where: { teamId },
          select: { id: true },
        });
        const currentMemberIds = currentMembers.map((m) => m.id);

        // Members to add (in input but not current)
        const membersToAdd = validMemberIds.filter(
          (id) => !currentMemberIds.includes(id)
        );

        // Members to remove (current but not in input)
        const membersToRemove = currentMemberIds.filter(
          (id) => !validMemberIds.includes(id)
        );

        // 2-1. Members to add: when moving from another team, remove them from the previous team's subscription assignments
        if (membersToAdd.length > 0) {
          // Fetch the previous team of members being added
          const usersWithPrevTeam = await tx.user.findMany({
            where: { id: { in: membersToAdd }, teamId: { not: null } },
            select: { id: true, teamId: true },
          });

          // Remove those users' assignments from the previous team's subscriptions
          for (const user of usersWithPrevTeam) {
            if (user.teamId) {
              // Fetch subscriptions assigned to the previous team
              const prevTeamSubscriptions = await tx.subscription.findMany({
                where: { teamId: user.teamId },
                select: { id: true },
              });

              if (prevTeamSubscriptions.length > 0) {
                // Remove user assignments from those subscriptions
                await tx.subscriptionUser.deleteMany({
                  where: {
                    userId: user.id,
                    subscriptionId: {
                      in: prevTeamSubscriptions.map((s) => s.id),
                    },
                  },
                });
              }
            }
          }

          // Move teams
          await tx.user.updateMany({
            where: { id: { in: membersToAdd } },
            data: { teamId },
          });
        }

        // 2-2. Members to remove: remove them from the current team's subscription assignments
        if (membersToRemove.length > 0) {
          // Fetch subscriptions assigned to the current team
          const teamSubscriptions = await tx.subscription.findMany({
            where: { teamId },
            select: { id: true },
          });

          if (teamSubscriptions.length > 0) {
            // Remove the departing members' assignments from those subscriptions
            await tx.subscriptionUser.deleteMany({
              where: {
                userId: { in: membersToRemove },
                subscriptionId: { in: teamSubscriptions.map((s) => s.id) },
              },
            });
          }

          // Remove from the team
          await tx.user.updateMany({
            where: { id: { in: membersToRemove } },
            data: { teamId: null },
          });
        }
      }

      return updated;
    });

    revalidatePath("/teams");
    revalidatePath("/users");
    revalidatePath("/subscriptions");

    return { success: true, data: updatedTeam, message: "Team updated" };
  } catch (error) {
    logger.error({ err: error }, "Team update error");
    if (isRedirectError(error)) throw error;
    return { success: false, message: "Failed to update the team" };
  }
}
export const updateTeam = withLogging("updateTeam", _updateTeam);

/**
 * Cycle check: whether targetId is a descendant of teamId
 */
async function checkIsDescendant(
  teamId: string,
  targetId: string
): Promise<boolean> {
  const children = await prisma.team.findMany({
    where: { parentId: teamId },
    select: { id: true },
  });

  for (const child of children) {
    if (child.id === targetId) {
      return true;
    }
    const isDescendant = await checkIsDescendant(child.id, targetId);
    if (isDescendant) {
      return true;
    }
  }

  return false;
}

/**
 * Get the impact of deleting a team
 */
export interface TeamImpact {
  memberCount: number; // affected members
  appCount: number; // assigned apps (AppTeam)
  subscriptionCount: number; // owned subscriptions
  cardCount: number; // corporate cards belonging to the team
  childTeamCount: number; // child teams
  paymentRecordCount: number; // SMP-78: assigned payment records
}

export async function getTeamImpact(
  teamId: string
): Promise<ActionState<TeamImpact>> {
  try {
    const { organizationId } = await requireOrganization();

    // Check the team exists and access is allowed
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { organizationId: true },
    });

    if (!team) {
      return { success: false, message: "Team not found" };
    }

    if (team.organizationId !== organizationId) {
      return { success: false, message: "You do not have access permission" };
    }

    // Fetch impact in parallel (SMP-78: added paymentRecordCount)
    const [
      memberCount,
      appCount,
      subscriptionCount,
      cardCount,
      childTeamCount,
      paymentRecordCount,
    ] = await Promise.all([
      prisma.user.count({ where: { teamId } }),
      prisma.appTeam.count({ where: { teamId } }),
      prisma.subscription.count({ where: { teamId } }),
      prisma.corporateCard.count({ where: { teamId } }),
      prisma.team.count({ where: { parentId: teamId } }),
      prisma.paymentRecord.count({ where: { teamId } }),
    ]);

    return {
      success: true,
      data: {
        memberCount,
        appCount,
        subscriptionCount,
        cardCount,
        childTeamCount,
        paymentRecordCount,
      },
    };
  } catch (error) {
    logger.error({ err: error }, "Team impact lookup error");
    if (isRedirectError(error)) throw error;
    return { success: false, message: "Failed to load the team impact" };
  }
}

/**
 * Delete a team (manually created teams only)
 */
async function _deleteTeam(teamId: string): Promise<ActionState> {
  try {
    const { organizationId, role } = await requireOrganization();

    if (role !== "ADMIN") {
      return { success: false, message: "Admin permission required" };
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { organizationId: true, googleOrgUnitId: true },
    });

    if (!team) {
      return { success: false, message: "Team not found" };
    }

    if (team.organizationId !== organizationId) {
      return { success: false, message: "You do not have access permission" };
    }

    // Teams synced from Google Workspace cannot be deleted
    if (team.googleOrgUnitId) {
      return {
        success: false,
        message:
          "Teams synced from Google Workspace cannot be deleted. Delete the OU in the Google Admin Console.",
      };
    }

    await prisma.team.delete({
      where: { id: teamId },
    });

    revalidatePath("/teams");

    return { success: true, message: "Team deleted" };
  } catch (error) {
    logger.error({ err: error }, "Team deletion error");
    if (isRedirectError(error)) throw error;
    return { success: false, message: "Failed to delete the team" };
  }
}
export const deleteTeam = withLogging("deleteTeam", _deleteTeam);

/**
 * Get team statistics (for the dashboard)
 */
export async function getTeamStats(): Promise<
  ActionState<{
    totalTeams: number;
    teamsWithMembers: number;
    avgMembersPerTeam: number;
    maxDepth: number;
  }>
> {
  try {
    const { organizationId } = await requireOrganization();

    const teams = await prisma.team.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    const totalTeams = teams.length;
    const teamsWithMembers = teams.filter((t) => t._count.members > 0).length;
    const totalMembers = teams.reduce((sum, t) => sum + t._count.members, 0);
    const avgMembersPerTeam =
      totalTeams > 0 ? Math.round((totalMembers / totalTeams) * 10) / 10 : 0;

    // Calculate the maximum depth (number of slashes in googleOrgUnitPath)
    const maxDepth = teams.reduce((max, team) => {
      if (!team.googleOrgUnitPath) return max;
      const depth = (team.googleOrgUnitPath.match(/\//g) || []).length;
      return Math.max(max, depth);
    }, 0);

    return {
      success: true,
      data: {
        totalTeams,
        teamsWithMembers,
        avgMembersPerTeam,
        maxDepth,
      },
    };
  } catch (error) {
    logger.error({ err: error }, "Team statistics error");
    if (isRedirectError(error)) throw error;
    return { success: false, message: "Failed to load team statistics" };
  }
}

/**
 * Assign a user to a team (manual)
 */
async function _assignUserToTeam(
  userId: string,
  teamId: string | null
): Promise<ActionState> {
  try {
    const { organizationId, role } = await requireOrganization();

    if (role !== "ADMIN") {
      return { success: false, message: "Admin permission required" };
    }

    // Look up the user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    if (!user) {
      return { success: false, message: "User not found" };
    }

    if (user.organizationId !== organizationId) {
      return { success: false, message: "You do not have access permission" };
    }

    // Verify the team (when teamId is given)
    if (teamId) {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { organizationId: true },
      });

      if (!team) {
        return { success: false, message: "Team not found" };
      }

      if (team.organizationId !== organizationId) {
        return { success: false, message: "You do not have access permission" };
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { teamId },
    });

    revalidatePath("/teams");
    revalidatePath("/users");

    return {
      success: true,
      message: teamId ? "Assigned to the team" : "Removed from the team",
    };
  } catch (error) {
    logger.error({ err: error }, "User team assignment error");
    if (isRedirectError(error)) throw error;
    return { success: false, message: "Failed to assign the user to the team" };
  }
}
export const assignUserToTeam = withLogging(
  "assignUserToTeam",
  _assignUserToTeam
);
