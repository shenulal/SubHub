// src/actions/org-sync.ts
/**
 * Organization/user CSV sync Server Actions
 * - Admin only
 */

"use server";

import { revalidatePath } from "next/cache";

import {
  parseCSV,
  validateOrgCSV,
  validateUserSyncCSV,
  type OrgCSVRow,
  type ValidationError,
} from "@/lib/csv-org";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import type { ActionState } from "@/types";

/** Org sync rewrites the team tree and member assignments. */
const ORG_SYNC_PERMISSIONS: PermissionKey[] = [
  "teams:manage",
  "members:manage",
];

// ==================== Types ====================

export interface OrgSyncResult {
  created: number;
  updated: number;
  errors: ValidationError[];
}

// ==================== Internal implementation ====================

/**
 * Organization CSV → upsert the Team hierarchy
 * Creates parents first in BFS order
 */
async function _syncOrgsFromCSV(
  csvContent: string
): Promise<ActionState<OrgSyncResult>> {
  try {
    const { organizationId } = await requirePermissionOrRedirect(
      ORG_SYNC_PERMISSIONS,
      "/dashboard"
    );

    const rows = parseCSV(csvContent);

    if (rows.length === 0) {
      return { success: false, message: "There is no data to import" };
    }

    const { valid, errors } = validateOrgCSV(rows);

    if (errors.length > 0 && valid.length === 0) {
      return {
        success: false,
        message: "There is no valid data",
        data: { created: 0, updated: 0, errors },
      };
    }

    // Prepare for BFS processing
    // Root nodes: no parent_code, or parent not present in the CSV
    const codeSet = new Set(valid.map((r) => r.org_code));
    const roots = valid.filter(
      (r) => !r.parent_code || !codeSet.has(r.parent_code)
    );
    const childrenMap = new Map<string, OrgCSVRow[]>();

    for (const row of valid) {
      if (row.parent_code && codeSet.has(row.parent_code)) {
        const arr = childrenMap.get(row.parent_code) ?? [];
        arr.push(row);
        childrenMap.set(row.parent_code, arr);
      }
    }

    // Pre-fetch existing teams by externalId
    const existingTeams = await prisma.team.findMany({
      where: { organizationId, externalId: { not: null } },
      select: { id: true, externalId: true },
    });
    const existingMap = new Map(
      existingTeams.map((t) => [t.externalId!, t.id])
    );

    // BFS traversal
    const queue: { row: OrgCSVRow; parentDbId: string | null }[] = roots.map(
      (r) => ({ row: r, parentDbId: null })
    );
    let created = 0;
    let updated = 0;

    while (queue.length > 0) {
      const item = queue.shift()!;
      const { row, parentDbId } = item;

      const existingId = existingMap.get(row.org_code);

      if (existingId) {
        // Update
        await prisma.team.update({
          where: { id: existingId },
          data: {
            name: row.org_name,
            parentId: parentDbId,
            source: "CSV_IMPORT",
          },
        });
        existingMap.set(row.org_code, existingId);
        updated++;
      } else {
        // Create
        const newTeam = await prisma.team.create({
          data: {
            name: row.org_name,
            externalId: row.org_code,
            source: "CSV_IMPORT",
            parentId: parentDbId,
            organizationId,
          },
        });
        existingMap.set(row.org_code, newTeam.id);
        created++;
      }

      // Enqueue child nodes
      const children = childrenMap.get(row.org_code) ?? [];
      const parentDbIdForChildren = existingMap.get(row.org_code)!;
      for (const child of children) {
        queue.push({ row: child, parentDbId: parentDbIdForChildren });
      }
    }

    revalidatePath("/teams");

    return {
      success: true,
      message: `Organization sync completed: ${created} created, ${updated} updated`,
      data: { created, updated, errors },
    };
  } catch (error) {
    logger.error({ err: error }, "Organization CSV sync error");
    return {
      success: false,
      message: "An error occurred while syncing the organization",
    };
  }
}

/**
 * User sync CSV → upsert User + assign team
 * org_code → look up Team.externalId → update teamId
 * Creates the team automatically if missing
 */
async function _syncUsersFromCSV(
  csvContent: string
): Promise<ActionState<OrgSyncResult>> {
  try {
    const { organizationId } = await requirePermissionOrRedirect(
      ORG_SYNC_PERMISSIONS,
      "/dashboard"
    );

    const rows = parseCSV(csvContent);

    if (rows.length === 0) {
      return { success: false, message: "There is no data to import" };
    }

    const { valid, errors } = validateUserSyncCSV(rows);

    if (errors.length > 0 && valid.length === 0) {
      return {
        success: false,
        message: "There is no valid data",
        data: { created: 0, updated: 0, errors },
      };
    }

    // Look up a Team per org_code (create if missing)
    const orgCodes = [...new Set(valid.map((r) => r.org_code))];
    const teamMap = new Map<string, string>(); // org_code → teamId

    for (const orgCode of orgCodes) {
      // Look up by externalId
      let team = await prisma.team.findFirst({
        where: { organizationId, externalId: orgCode },
        select: { id: true },
      });

      if (!team) {
        // Create automatically if missing (flat, source=CSV_IMPORT)
        team = await prisma.team.create({
          data: {
            name: orgCode,
            externalId: orgCode,
            source: "CSV_IMPORT",
            organizationId,
          },
          select: { id: true },
        });
      }

      teamMap.set(orgCode, team.id);
    }

    let created = 0;
    let updated = 0;

    for (const row of valid) {
      const teamId = teamMap.get(row.org_code);

      const existingUser = await prisma.user.findFirst({
        where: { email: row.email, organizationId },
        select: { id: true },
      });

      if (existingUser) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name: row.name,
            teamId: teamId ?? null,
            ...(row.employee_id ? { employeeId: row.employee_id } : {}),
          },
        });
        updated++;
      } else {
        await prisma.user.create({
          data: {
            email: row.email,
            name: row.name,
            role: "MEMBER",
            organizationId,
            teamId: teamId ?? null,
            ...(row.employee_id ? { employeeId: row.employee_id } : {}),
          },
        });
        created++;
      }
    }

    revalidatePath("/users");
    revalidatePath("/teams");

    return {
      success: true,
      message: `User sync completed: ${created} created, ${updated} updated`,
      data: { created, updated, errors },
    };
  } catch (error) {
    logger.error({ err: error }, "User CSV sync error");
    return {
      success: false,
      message: "An error occurred while syncing users",
    };
  }
}

// ==================== Public Server Actions ====================

export const syncOrgsFromCSV = withLogging("syncOrgsFromCSV", _syncOrgsFromCSV);

export const syncUsersFromCSV = withLogging(
  "syncUsersFromCSV",
  _syncUsersFromCSV
);
