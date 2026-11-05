// src/lib/services/sso/userSync.ts
/**
 * Google Workspace user sync service
 * Syncs Google Workspace users with the DB User table
 *
 * pgbouncer-compatible: uses individual queries instead of long transactions
 */

import { prisma } from "@/lib/db";
import type {
  GoogleWorkspaceUser,
  SyncError,
  SyncResult,
  UserSyncOptions,
} from "@/types/sso";
import type { Integration, Prisma, UserStatus } from "@prisma/client";
import { GoogleWorkspaceService } from "./googleWorkspace";

/**
 * Maps a Google Workspace user to the DB User shape
 * @param teamMap orgUnitPath -> teamId mapping (optional)
 */
export function mapGoogleUserToDbUser(
  googleUser: GoogleWorkspaceUser,
  organizationId: string,
  teamMap?: Map<string, string>
): {
  email: string;
  name: string;
  image?: string;
  employeeId: string;
  department?: string;
  jobTitle?: string;
  status: UserStatus;
  organizationId: string;
  lastLoginAt?: Date;
  isGoogleAdmin: boolean;
  teamId?: string;
  /** Manager e-mail (used in the second pass) */
  _managerEmail?: string;
} {
  // Extract the primary organization details
  const primaryOrg =
    googleUser.organizations?.find((o) => o.primary) ||
    googleUser.organizations?.[0];

  // Extract the manager e-mail
  const managerRelation = googleUser.relations?.find(
    (r) => r.type === "manager"
  );

  // Look up the team ID (by orgUnitPath)
  const teamId =
    teamMap && googleUser.orgUnitPath
      ? teamMap.get(googleUser.orgUnitPath)
      : undefined;

  return {
    email: googleUser.primaryEmail,
    name: googleUser.name.fullName,
    image: googleUser.thumbnailPhotoUrl,
    employeeId: googleUser.id,
    department: primaryOrg?.department || googleUser.orgUnitPath,
    jobTitle: primaryOrg?.title,
    status: googleUser.suspended ? "TERMINATED" : "ACTIVE",
    organizationId,
    lastLoginAt: googleUser.lastLoginTime
      ? new Date(googleUser.lastLoginTime)
      : undefined,
    isGoogleAdmin: googleUser.isAdmin || false,
    teamId,
    _managerEmail: managerRelation?.value,
  };
}

/**
 * Syncs users from Google Workspace
 * pgbouncer-compatible: minimises transactions and uses individual queries
 * @param teamMap orgUnitPath -> teamId mapping (optional, passed after team sync)
 */
export async function syncUsersFromGoogle(
  integration: Integration,
  googleService: GoogleWorkspaceService,
  options: UserSyncOptions = {},
  teamMap?: Map<string, string>
): Promise<SyncResult> {
  const {
    createNew = true,
    updateExisting = true,
    detectTerminated = true,
    orgUnitPath,
  } = options;

  const startTime = Date.now();
  const errors: SyncError[] = [];
  let itemsFound = 0;
  let itemsCreated = 0;
  let itemsUpdated = 0;
  let syncLogId: string | undefined;

  // Mapping for setting manager relationships (email -> managerEmail)
  const managerRelations: Map<string, string> = new Map();

  try {
    // 1. Create the sync start log (single query)
    const syncLog = await prisma.syncLog.create({
      data: {
        integrationId: integration.id,
        status: "RUNNING",
        startedAt: new Date(),
        itemsFound: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
      },
    });
    syncLogId = syncLog.id;

    // 2. List users from Google Workspace
    const googleUsers = await googleService.listUsers(orgUnitPath);
    itemsFound = googleUsers.length;

    // 3. First pass: process each user individually (no transaction)
    for (const googleUser of googleUsers) {
      try {
        const userData = mapGoogleUserToDbUser(
          googleUser,
          integration.organizationId,
          teamMap
        );

        // Store the manager relationship (handled in the second pass)
        if (userData._managerEmail) {
          managerRelations.set(userData.email, userData._managerEmail);
        }

        if (createNew || updateExisting) {
          // upsert: create if missing, otherwise update
          const existingUser = await prisma.user.findUnique({
            where: { email: userData.email },
          });

          if (!existingUser && createNew) {
            await prisma.user.create({
              data: {
                email: userData.email,
                name: userData.name,
                image: userData.image,
                employeeId: userData.employeeId,
                department: userData.department,
                jobTitle: userData.jobTitle,
                status: userData.status,
                organizationId: userData.organizationId,
                lastLoginAt: userData.lastLoginAt,
                isGoogleAdmin: userData.isGoogleAdmin,
                teamId: userData.teamId,
                role: "MEMBER",
              },
            });
            itemsCreated++;
          } else if (existingUser && updateExisting) {
            // Update only when the organization ID matches
            if (existingUser.organizationId === integration.organizationId) {
              const updateData: Prisma.UserUncheckedUpdateInput = {
                name: userData.name,
                image: userData.image,
                employeeId: userData.employeeId,
                department: userData.department,
                jobTitle: userData.jobTitle,
                lastLoginAt: userData.lastLoginAt,
                isGoogleAdmin: userData.isGoogleAdmin,
                teamId: userData.teamId,
              };

              // Update status only when offboarding detection is enabled
              if (detectTerminated) {
                updateData.status = userData.status;
                if (userData.status === "TERMINATED") {
                  updateData.terminatedAt = new Date();
                }
              }

              await prisma.user.update({
                where: { id: existingUser.id },
                data: updateData,
              });
              itemsUpdated++;
            }
          }
        }
      } catch (userError) {
        errors.push({
          code: "USER_SYNC_ERROR",
          message:
            userError instanceof Error ? userError.message : "Unknown error",
          entity: "User",
          entityId: googleUser.primaryEmail,
        });
      }
    }

    // 4. Second pass: set manager relationships (individual queries)
    for (const [userEmail, managerEmail] of managerRelations) {
      try {
        // Look up the manager
        const manager = await prisma.user.findFirst({
          where: {
            email: managerEmail,
            organizationId: integration.organizationId,
          },
          select: { id: true },
        });

        if (manager) {
          await prisma.user.updateMany({
            where: {
              organizationId: integration.organizationId,
              email: userEmail,
            },
            data: { managerId: manager.id },
          });
        }
      } catch (managerError) {
        // Record manager relationship failures as errors but continue the sync
        console.warn(
          `Failed to set manager relationship: ${userEmail} -> ${managerEmail}`,
          managerError
        );
      }
    }

    // 5. Update the sync log as completed (single query)
    const finalStatus = errors.length > 0 ? "PARTIAL" : "SUCCESS";
    await prisma.syncLog.update({
      where: { id: syncLogId },
      data: {
        status: finalStatus,
        itemsFound,
        itemsCreated,
        itemsUpdated,
        errors:
          errors.length > 0 ? JSON.parse(JSON.stringify(errors)) : undefined,
        completedAt: new Date(),
      },
    });

    // 6. Update the integration's last sync time (single query)
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        lastSyncAt: new Date(),
        lastError: errors.length > 0 ? errors[0].message : null,
        status: "ACTIVE",
      },
    });

    return {
      status: finalStatus as "PARTIAL" | "SUCCESS",
      itemsFound,
      itemsCreated,
      itemsUpdated,
      errors,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    // Full sync failed
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Update the failure log
    if (syncLogId) {
      await prisma.syncLog.update({
        where: { id: syncLogId },
        data: {
          status: "FAILED",
          errors: [{ code: "SYNC_FAILED", message: errorMessage }],
          completedAt: new Date(),
        },
      });
    }

    // Update the integration error
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        lastError: errorMessage,
        status: "ERROR",
      },
    });

    return {
      status: "FAILED",
      itemsFound: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      errors: [
        {
          code: "SYNC_FAILED",
          message: errorMessage,
        },
      ],
      duration: Date.now() - startTime,
    };
  }
}
