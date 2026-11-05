// src/lib/services/sso/googleSync.ts
/**
 * Google Workspace full sync service
 * Runs Team (OU) sync and User sync together
 */

import { prisma } from "@/lib/db";
import type {
  FullSyncResult,
  IntegrationCredentials,
  SyncError,
} from "@/types/sso";
import { GoogleWorkspaceService } from "./googleWorkspace";
import { getTeamPathMap, syncTeamsFromGoogle } from "./teamSync";
import { syncUsersFromGoogle } from "./userSync";

/**
 * Creates a GoogleWorkspaceService from the integration credentials
 */
function createServiceFromCredentials(
  credentials: IntegrationCredentials
): GoogleWorkspaceService {
  if (
    !credentials.serviceAccountEmail ||
    !credentials.privateKey ||
    !credentials.adminEmail
  ) {
    throw new Error("Google Workspace credentials are invalid");
  }

  return new GoogleWorkspaceService({
    clientEmail: credentials.serviceAccountEmail,
    privateKey: credentials.privateKey.replace(/\\n/g, "\n"),
    subject: credentials.adminEmail,
  });
}

/**
 * Runs the full Google Workspace sync
 * Order: Team (OU) sync → User sync (with team mapping)
 */
export async function fullGoogleWorkspaceSync(
  integrationId: string
): Promise<FullSyncResult> {
  const startTime = Date.now();
  const errors: SyncError[] = [];

  // 1. Load the integration
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration) {
    throw new Error(`Integration not found: ${integrationId}`);
  }

  if (integration.type !== "GOOGLE_WORKSPACE") {
    throw new Error(`Not a Google Workspace integration: ${integration.type}`);
  }

  // 2. Create the Google service
  const credentials = integration.credentials as IntegrationCredentials;
  const googleService = createServiceFromCredentials(credentials);

  // 3. Connection test
  const isConnected = await googleService.testConnection();
  if (!isConnected) {
    throw new Error("Failed to connect to Google Workspace");
  }

  // 4. Team (OU) sync
  const teamResult = await syncTeamsFromGoogle(
    integration,
    googleService,
    integration.organizationId
  );

  if (teamResult.errors.length > 0) {
    errors.push(...teamResult.errors);
  }

  // 5. Load the team mapping (used for user sync)
  const teamMap = await getTeamPathMap(integration.organizationId);

  // 6. User sync (with team mapping)
  const userResult = await syncUsersFromGoogle(
    integration,
    googleService,
    {
      createNew: true,
      updateExisting: true,
      detectTerminated: true,
    },
    teamMap
  );

  if (userResult.errors.length > 0) {
    errors.push(...userResult.errors);
  }

  // 7. Update the integration status
  await prisma.integration.update({
    where: { id: integrationId },
    data: {
      lastSyncAt: new Date(),
      lastError: errors.length > 0 ? errors[0].message : null,
      status: errors.length > 0 ? "ERROR" : "ACTIVE",
    },
  });

  const totalDuration = Date.now() - startTime;

  return {
    teamResult,
    userResult,
    totalDuration,
  };
}

/**
 * Checks an organization's Google Workspace integration status
 */
export async function checkGoogleWorkspaceConnection(
  organizationId: string
): Promise<{
  connected: boolean;
  integration?: { id: string; status: string };
}> {
  const integration = await prisma.integration.findFirst({
    where: {
      organizationId,
      type: "GOOGLE_WORKSPACE",
    },
    select: {
      id: true,
      status: true,
      credentials: true,
    },
  });

  if (!integration) {
    return { connected: false };
  }

  try {
    const credentials = integration.credentials as IntegrationCredentials;
    const googleService = createServiceFromCredentials(credentials);
    const isConnected = await googleService.testConnection();

    return {
      connected: isConnected,
      integration: {
        id: integration.id,
        status: integration.status,
      },
    };
  } catch {
    return {
      connected: false,
      integration: {
        id: integration.id,
        status: integration.status,
      },
    };
  }
}
