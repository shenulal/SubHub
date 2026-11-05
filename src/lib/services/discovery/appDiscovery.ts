// src/lib/services/discovery/appDiscovery.ts
/**
 * App discovery service based on Google Workspace OAuth tokens
 * Collects OAuth apps authorised by users and registers them as SaaS apps
 */

import { prisma } from "@/lib/db";
import type {
  AppDiscoveryOptions,
  DiscoveredApp,
  GoogleOAuthToken,
  GoogleWorkspaceUser,
  SyncError,
  SyncResult,
} from "@/types/sso";
import type { Integration } from "@prisma/client";
import { GoogleWorkspaceService } from "../sso/googleWorkspace";

// Google system app clientId patterns to filter out
const GOOGLE_SYSTEM_APPS = [
  "google.com",
  "googleapis.com",
  "accounts.google.com",
];

/**
 * Aggregates per-user OAuth tokens by app
 */
export function processDiscoveredApps(
  usersWithTokens: { user: GoogleWorkspaceUser; tokens: GoogleOAuthToken[] }[]
): DiscoveredApp[] {
  const appMap = new Map<string, DiscoveredApp>();

  for (const { user, tokens } of usersWithTokens) {
    for (const token of tokens) {
      // Filter out Google system apps
      if (
        GOOGLE_SYSTEM_APPS.some((pattern) => token.clientId.includes(pattern))
      ) {
        continue;
      }

      const existing = appMap.get(token.clientId);

      if (existing) {
        existing.users.push({
          email: user.primaryEmail,
        });
        existing.userCount = existing.users.length;
      } else {
        appMap.set(token.clientId, {
          clientId: token.clientId,
          name: token.displayText,
          scopes: token.scopes,
          users: [{ email: user.primaryEmail }],
          userCount: 1,
        });
      }
    }
  }

  return Array.from(appMap.values());
}

/**
 * Runs app discovery against Google Workspace
 */
export async function discoverAppsFromGoogle(
  integration: Integration,
  googleService: GoogleWorkspaceService,
  options: AppDiscoveryOptions = {}
): Promise<SyncResult> {
  const { minUsers = 1, matchCatalog = true, updateExisting = true } = options;

  const startTime = Date.now();
  const errors: SyncError[] = [];
  let itemsFound = 0;
  let itemsCreated = 0;
  let itemsUpdated = 0;
  let syncLogId: string | undefined;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create the sync log
      const syncLog = await tx.syncLog.create({
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

      // List users
      const users = await googleService.listUsers();

      // Collect each user's OAuth tokens
      const usersWithTokens: {
        user: GoogleWorkspaceUser;
        tokens: GoogleOAuthToken[];
      }[] = [];

      for (const user of users) {
        try {
          const tokens = await googleService.listTokens(user.primaryEmail);
          if (tokens.length > 0) {
            usersWithTokens.push({ user, tokens });
          }
        } catch (tokenError) {
          // Ignore token lookup failures for individual users and continue
          errors.push({
            code: "TOKEN_FETCH_ERROR",
            message:
              tokenError instanceof Error
                ? tokenError.message
                : "Unknown error",
            entity: "User",
            entityId: user.primaryEmail,
          });
        }
      }

      // Aggregate apps
      const discoveredApps = processDiscoveredApps(usersWithTokens);

      // Filter by minimum user count
      const filteredApps = discoveredApps.filter(
        (app) => app.userCount >= minUsers
      );
      itemsFound = filteredApps.length;

      // Process each app
      for (const discoveredApp of filteredApps) {
        try {
          // SaaS catalog matching (optional)
          let catalogId: string | null = null;
          if (matchCatalog) {
            const catalog = await tx.saaSCatalog.findFirst({
              where: {
                OR: [
                  { name: { equals: discoveredApp.name, mode: "insensitive" } },
                  { patterns: { some: { pattern: discoveredApp.clientId } } },
                ],
              },
            });
            catalogId = catalog?.id || null;
          }

          // Check for an existing app
          const existingApp = await tx.app.findFirst({
            where: {
              organizationId: integration.organizationId,
              OR: [
                { name: discoveredApp.name },
                { notes: { contains: discoveredApp.clientId } },
              ],
            },
          });

          let appId: string;

          if (!existingApp) {
            // Create a new app
            const newApp = await tx.app.create({
              data: {
                name: discoveredApp.name,
                organization: {
                  connect: { id: integration.organizationId },
                },
                source: "SSO_DISCOVERY",
                status: "ACTIVE",
                catalog: catalogId ? { connect: { id: catalogId } } : undefined,
                discoveredAt: new Date(),
                notes: `OAuth Client ID: ${discoveredApp.clientId}`,
              },
            });
            appId = newApp.id;
            itemsCreated++;
          } else if (updateExisting) {
            // Update the existing app
            appId = existingApp.id;
            itemsUpdated++;
          } else {
            appId = existingApp.id;
          }

          // Create user-app access records
          for (const appUser of discoveredApp.users) {
            const dbUser = await tx.user.findUnique({
              where: { email: appUser.email },
            });

            if (
              dbUser &&
              dbUser.organizationId === integration.organizationId
            ) {
              await tx.userAppAccess.upsert({
                where: {
                  userId_appId: {
                    userId: dbUser.id,
                    appId,
                  },
                },
                create: {
                  userId: dbUser.id,
                  appId,
                  source: "SSO_LOG",
                  lastUsedAt: new Date(),
                },
                update: {
                  lastUsedAt: new Date(),
                },
              });
            }
          }
        } catch (appError) {
          errors.push({
            code: "APP_PROCESS_ERROR",
            message:
              appError instanceof Error ? appError.message : "Unknown error",
            entity: "App",
            entityId: discoveredApp.clientId,
          });
        }
      }

      // Update the sync log as completed
      await tx.syncLog.update({
        where: { id: syncLogId },
        data: {
          status: errors.length > 0 ? "PARTIAL" : "SUCCESS",
          itemsFound,
          itemsCreated,
          itemsUpdated,
          errors:
            errors.length > 0 ? JSON.parse(JSON.stringify(errors)) : undefined,
          completedAt: new Date(),
        },
      });

      // Update the integration's last sync time
      await tx.integration.update({
        where: { id: integration.id },
        data: {
          lastSyncAt: new Date(),
          lastError: errors.length > 0 ? errors[0].message : null,
        },
      });

      const finalStatus = errors.length > 0 ? "PARTIAL" : "SUCCESS";
      return {
        status: finalStatus as "PARTIAL" | "SUCCESS",
        itemsFound,
        itemsCreated,
        itemsUpdated,
        errors,
        duration: Date.now() - startTime,
      };
    });

    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Update the failure log
    if (syncLogId) {
      await prisma.syncLog.update({
        where: { id: syncLogId },
        data: {
          status: "FAILED",
          errors: [{ code: "DISCOVERY_FAILED", message: errorMessage }],
          completedAt: new Date(),
        },
      });
    }

    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        lastError: errorMessage,
      },
    });

    return {
      status: "FAILED",
      itemsFound: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      errors: [
        {
          code: "DISCOVERY_FAILED",
          message: errorMessage,
        },
      ],
      duration: Date.now() - startTime,
    };
  }
}
