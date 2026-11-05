// src/lib/services/sso/teamSync.ts
/**
 * Google Workspace OU -> Team sync service
 * Stores Organizational Units in the Team table as a hierarchy
 */

import { prisma } from "@/lib/db";
import type { GoogleOrgUnit, SyncError, TeamSyncResult } from "@/types/sso";
import type { Integration, Team } from "@prisma/client";
import type { GoogleWorkspaceService } from "./googleWorkspace";

/**
 * Sorts OUs parent-first
 * Excludes the root OU ("/") and sorts by shortest parent path first
 */
function sortOrgUnitsByHierarchy(orgUnits: GoogleOrgUnit[]): GoogleOrgUnit[] {
  // Exclude the root OU (path "/" or empty)
  const filtered = orgUnits.filter(
    (ou) => ou.orgUnitPath && ou.orgUnitPath !== "/"
  );

  // Sort by path depth (number of slashes) - parents first
  return filtered.sort((a, b) => {
    const depthA = (a.orgUnitPath.match(/\//g) || []).length;
    const depthB = (b.orgUnitPath.match(/\//g) || []).length;
    if (depthA !== depthB) {
      return depthA - depthB;
    }
    // Same depth: alphabetical by path
    return a.orgUnitPath.localeCompare(b.orgUnitPath);
  });
}

/**
 * Finds the parent team ID
 * @param parentOrgUnitPath Parent OU path
 * @param organizationId Organization ID
 * @param teamCache Cache of teams already created/loaded
 */
async function findParentTeamId(
  parentOrgUnitPath: string | undefined,
  organizationId: string,
  teamCache: Map<string, string>
): Promise<string | null> {
  if (!parentOrgUnitPath || parentOrgUnitPath === "/") {
    return null;
  }

  // Check the cache first
  const cachedId = teamCache.get(parentOrgUnitPath);
  if (cachedId) {
    return cachedId;
  }

  // Look up in the DB
  const parentTeam = await prisma.team.findFirst({
    where: {
      organizationId,
      googleOrgUnitPath: parentOrgUnitPath,
    },
    select: { id: true },
  });

  if (parentTeam) {
    teamCache.set(parentOrgUnitPath, parentTeam.id);
    return parentTeam.id;
  }

  return null;
}

/**
 * Syncs Google Workspace OUs to teams
 */
export async function syncTeamsFromGoogle(
  integration: Integration,
  googleService: GoogleWorkspaceService,
  organizationId: string
): Promise<TeamSyncResult> {
  const startTime = Date.now();
  const errors: SyncError[] = [];
  let itemsFound = 0;
  let itemsCreated = 0;
  let itemsUpdated = 0;

  try {
    // 1. Fetch all OUs from Google
    const googleOrgUnits = await googleService.listOrgUnits();
    itemsFound = googleOrgUnits.length;

    // 2. Sort parent-first
    const sortedOrgUnits = sortOrgUnitsByHierarchy(googleOrgUnits);

    // 3. Team cache (orgUnitPath -> teamId)
    const teamCache = new Map<string, string>();

    // 4. Load existing teams into the cache
    const existingTeams = await prisma.team.findMany({
      where: { organizationId },
      select: { id: true, googleOrgUnitPath: true },
    });
    existingTeams.forEach((team) => {
      if (team.googleOrgUnitPath) {
        teamCache.set(team.googleOrgUnitPath, team.id);
      }
    });

    // 5. Upsert each OU as a team
    for (const orgUnit of sortedOrgUnits) {
      try {
        const parentId = await findParentTeamId(
          orgUnit.parentOrgUnitPath,
          organizationId,
          teamCache
        );

        const teamData = {
          name: orgUnit.name,
          description: orgUnit.description || null,
          googleOrgUnitId: orgUnit.orgUnitId,
          googleOrgUnitPath: orgUnit.orgUnitPath,
          parentId,
          organizationId,
        };

        // Run the upsert
        const result = await prisma.team.upsert({
          where: {
            organizationId_googleOrgUnitPath: {
              organizationId,
              googleOrgUnitPath: orgUnit.orgUnitPath,
            },
          },
          create: teamData,
          update: {
            name: orgUnit.name,
            description: orgUnit.description || null,
            parentId,
          },
        });

        // Update the cache
        teamCache.set(orgUnit.orgUnitPath, result.id);

        // Count creates/updates
        if (
          existingTeams.some((t) => t.googleOrgUnitPath === orgUnit.orgUnitPath)
        ) {
          itemsUpdated++;
        } else {
          itemsCreated++;
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        errors.push({
          code: "TEAM_SYNC_ERROR",
          message: errorMessage,
          entity: "Team",
          entityId: orgUnit.orgUnitPath,
          timestamp: new Date(),
        });
      }
    }

    const duration = Date.now() - startTime;

    return {
      status: errors.length > 0 ? "PARTIAL" : "SUCCESS",
      itemsFound,
      itemsCreated,
      itemsUpdated,
      errors,
      duration,
    };
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return {
      status: "FAILED",
      itemsFound,
      itemsCreated,
      itemsUpdated,
      errors: [
        {
          code: "SYNC_FAILED",
          message: errorMessage,
          timestamp: new Date(),
        },
      ],
      duration,
    };
  }
}

/**
 * Returns all of the organization's teams as a tree
 */
export async function getTeamTree(organizationId: string): Promise<Team[]> {
  return prisma.team.findMany({
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
}

/**
 * Returns the orgUnitPath → team ID mapping
 */
export async function getTeamPathMap(
  organizationId: string
): Promise<Map<string, string>> {
  const teams = await prisma.team.findMany({
    where: { organizationId },
    select: { id: true, googleOrgUnitPath: true },
  });

  const map = new Map<string, string>();
  teams.forEach((team) => {
    if (team.googleOrgUnitPath) {
      map.set(team.googleOrgUnitPath, team.id);
    }
  });

  return map;
}
