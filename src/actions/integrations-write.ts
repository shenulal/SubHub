// src/actions/integrations-write.ts
"use server";

/**
 * Integration create/update/delete Server Actions
 */

import { getCachedSession, requireOrganization } from "@/lib/auth/require-auth";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import {
  getERPAdapter,
  isERPIntegrationType,
  type ERPCredentials,
} from "@/lib/services/erp";
import { fullGoogleWorkspaceSync } from "@/lib/services/sso/googleSync";
import { GoogleWorkspaceService } from "@/lib/services/sso/googleWorkspace";
import type { ActionState } from "@/types";
import type {
  CreateIntegrationInput,
  FullSyncResult,
  IntegrationCredentials,
} from "@/types/sso";
import type { Integration, IntegrationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { can } from "@/lib/rbac/service";
import type { IntegrationSettingsInput } from "./integrations.types";
import { isRedirectError } from "./integrations.types";

/**
 * Create a new integration
 */
async function _createIntegration(
  input: CreateIntegrationInput
): Promise<ActionState<{ integration: Integration }>> {
  try {
    const session = await getCachedSession();
    if (!session?.user?.id) {
      return { success: false, message: "Authentication required" };
    }
    if (!session.user.organizationId) {
      return { success: false, message: "You must belong to an organization" };
    }
    if (!(await can("integrations:manage"))) {
      return {
        success: false,
        message: "You do not have permission to perform this action",
      };
    }

    const organizationId = session.user.organizationId;

    // Duplicate check
    const existing = await prisma.integration.findFirst({
      where: {
        organizationId,
        type: input.type,
      },
    });

    if (existing) {
      return {
        success: false,
        message: "An integration of this type already exists",
      };
    }

    // For Google Workspace, normalize the private key and test the connection
    let normalizedCredentials = input.credentials;
    if (input.type === "GOOGLE_WORKSPACE") {
      const creds = input.credentials as IntegrationCredentials;

      // Private key normalization:
      // 1. Trim surrounding whitespace
      // 2. Strip surrounding quotes (may be included when copied from JSON)
      // 3. Convert literal \n sequences to real line breaks
      let normalizedPrivateKey = creds.privateKey?.trim();
      if (normalizedPrivateKey) {
        // Strip surrounding quotes (", ')
        normalizedPrivateKey = normalizedPrivateKey.replace(/^["']|["']$/g, "");
        // Convert \n escape sequences to real line breaks
        normalizedPrivateKey = normalizedPrivateKey.replace(/\\n/g, "\n");
      }

      normalizedCredentials = {
        ...creds,
        privateKey: normalizedPrivateKey,
      };

      if (
        creds.serviceAccountEmail &&
        normalizedPrivateKey &&
        creds.adminEmail
      ) {
        try {
          logger.info(
            "[Integration] Starting Google Workspace connection test..."
          );
          logger.info(
            "[Integration] clientEmail: %s",
            creds.serviceAccountEmail
          );
          logger.info("[Integration] subject: %s", creds.adminEmail);
          logger.info(
            "[Integration] privateKey prefix: %s",
            normalizedPrivateKey?.substring(0, 50)
          );

          const service = new GoogleWorkspaceService({
            clientEmail: creds.serviceAccountEmail,
            privateKey: normalizedPrivateKey,
            subject: creds.adminEmail,
          });
          const connected = await service.testConnection();
          logger.info("[Integration] Connection test result: %s", connected);

          if (!connected) {
            return {
              success: false,
              message: "Google Workspace connection test failed",
            };
          }
        } catch (error) {
          logger.error(
            { err: error },
            "[Integration] Google Workspace connection test error"
          );
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          return {
            success: false,
            message: `Google Workspace connection failed: ${errorMessage}`,
          };
        }
      }
    }

    // DA-98: for ERP types, encrypt credentials and test the connection
    if (isERPIntegrationType(input.type)) {
      const erpCreds = normalizedCredentials as ERPCredentials;
      const adapter = getERPAdapter(input.type);

      if (adapter) {
        try {
          const connected = await adapter.testConnection(erpCreds);
          if (!connected) {
            return {
              success: false,
              message: `${adapter.name} connection test failed`,
            };
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          return {
            success: false,
            message: `${adapter.name} connection failed: ${errorMessage}`,
          };
        }
      }

      // ERP credentials are stored encrypted
      normalizedCredentials = {
        encrypted: encryptJson(erpCreds),
        type: input.type,
      } as unknown as typeof normalizedCredentials;
    }

    const integration = await prisma.integration.create({
      data: {
        organizationId,
        type: input.type,
        status: "PENDING",
        credentials: normalizedCredentials as object,
        metadata: (input.metadata || {}) as object,
      },
    });

    revalidatePath("/settings/integrations");

    return { success: true, data: { integration } };
  } catch (error) {
    logger.error({ err: error }, "Integration creation error");
    if (isRedirectError(error)) throw error;
    return {
      success: false,
      message: "An error occurred while creating the integration",
    };
  }
}
export const createIntegration = withLogging(
  "createIntegration",
  _createIntegration
);

/**
 * Update integration status
 */
async function _updateIntegrationStatus(
  integrationId: string,
  status: IntegrationStatus
): Promise<ActionState> {
  try {
    const session = await getCachedSession();
    if (!session?.user?.organizationId) {
      return { success: false, message: "Authentication required" };
    }
    if (!(await can("integrations:manage"))) {
      return {
        success: false,
        message: "You do not have permission to perform this action",
      };
    }

    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      return { success: false, message: "Integration not found" };
    }

    if (integration.organizationId !== session.user.organizationId) {
      return { success: false, message: "You do not have access permission" };
    }

    await prisma.integration.update({
      where: { id: integrationId },
      data: { status },
    });

    revalidatePath("/settings/integrations");

    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "Integration status update error");
    if (isRedirectError(error)) throw error;
    return {
      success: false,
      message: "An error occurred while updating the integration status",
    };
  }
}
export const updateIntegrationStatus = withLogging(
  "updateIntegrationStatus",
  _updateIntegrationStatus
);

/**
 * Delete an integration
 */
async function _deleteIntegration(integrationId: string): Promise<ActionState> {
  try {
    const { organizationId } = await requireOrganization();

    if (!(await can("integrations:manage"))) {
      return { success: false, message: "Admin permission required" };
    }

    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      return { success: false, message: "Integration not found" };
    }

    if (integration.organizationId !== organizationId) {
      return { success: false, message: "You do not have access permission" };
    }

    await prisma.integration.delete({
      where: { id: integrationId },
    });

    revalidatePath("/settings/integrations");

    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "Integration deletion error");
    if (isRedirectError(error)) throw error;
    return {
      success: false,
      message: "An error occurred while deleting the integration",
    };
  }
}
export const deleteIntegration = withLogging(
  "deleteIntegration",
  _deleteIntegration
);

/**
 * Run an immediate sync (full Team + User sync)
 */
async function _syncIntegrationNow(
  integrationId: string
): Promise<ActionState<{ result: FullSyncResult }>> {
  try {
    const { organizationId } = await requireOrganization();

    if (!(await can("integrations:manage"))) {
      return { success: false, message: "Admin permission required" };
    }

    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      return { success: false, message: "Integration not found" };
    }

    if (integration.organizationId !== organizationId) {
      return { success: false, message: "You do not have access permission" };
    }

    if (integration.type === "GOOGLE_WORKSPACE") {
      // Full Google Workspace sync (Team + User)
      const result = await fullGoogleWorkspaceSync(integrationId);

      revalidatePath("/settings/integrations");
      revalidatePath("/users");
      revalidatePath("/teams");

      return { success: true, data: { result } };
    }

    // DA-100: manual ERP sync
    if (isERPIntegrationType(integration.type)) {
      const adapter = getERPAdapter(integration.type);
      if (!adapter) {
        return { success: false, message: "Unsupported ERP type" };
      }

      // Decrypt credentials
      const creds = integration.credentials as { encrypted?: string };
      if (!creds.encrypted) {
        return { success: false, message: "No ERP credentials found" };
      }
      const erpCredentials = decryptJson<ERPCredentials>(creds.encrypted);

      // Sync the last 30 days of data
      const now = new Date();
      const fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const syncResult = await adapter.fetchPayments(erpCredentials, {
        fromDate,
        toDate: now,
      });

      // Write the SyncLog
      await prisma.syncLog.create({
        data: {
          integrationId,
          status: syncResult.success ? "SUCCESS" : "FAILED",
          itemsFound: syncResult.totalCount,
          itemsCreated: syncResult.items.length,
          itemsUpdated: 0,
          errors: syncResult.errorMessage
            ? ([{ message: syncResult.errorMessage }] as object[])
            : [],
          startedAt: now,
          completedAt: new Date(),
        },
      });

      await prisma.integration.update({
        where: { id: integrationId },
        data: {
          lastSyncAt: new Date(),
          status: syncResult.success ? "ACTIVE" : "ERROR",
          lastError: syncResult.errorMessage || null,
        },
      });

      revalidatePath("/settings/integrations");
      revalidatePath("/payments");

      return {
        success: syncResult.success,
        data: {
          result: {
            teamResult: { created: 0, updated: 0, deleted: 0, errors: [] },
            userResult: {
              created: syncResult.totalCount,
              updated: 0,
              deactivated: 0,
              errors: syncResult.errorMessage ? [syncResult.errorMessage] : [],
            },
            totalDuration: 0,
          } as unknown as FullSyncResult,
        },
        message: syncResult.success
          ? `Synced ${syncResult.totalCount} ERP payment records`
          : syncResult.errorMessage,
      };
    }

    return {
      success: false,
      message: "Unsupported integration type",
    };
  } catch (error) {
    logger.error({ err: error }, "Integration sync error");
    if (isRedirectError(error)) throw error;
    return {
      success: false,
      message: "An error occurred while syncing the integration",
    };
  }
}
export const syncIntegrationNow = withLogging(
  "syncIntegrationNow",
  _syncIntegrationNow
);

/**
 * Update integration settings (values in metadata)
 */
async function _updateIntegrationSettings(
  integrationId: string,
  settings: IntegrationSettingsInput
): Promise<ActionState> {
  try {
    const session = await getCachedSession();
    if (!session?.user?.organizationId) {
      return { success: false, message: "Authentication required" };
    }
    if (!(await can("integrations:manage"))) {
      return {
        success: false,
        message: "You do not have permission to perform this action",
      };
    }

    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      return { success: false, message: "Integration not found" };
    }

    if (integration.organizationId !== session.user.organizationId) {
      return { success: false, message: "You do not have access permission" };
    }

    // Merge with existing metadata
    const existingMetadata =
      (integration.metadata as Record<string, unknown>) || {};
    const updatedMetadata = {
      ...existingMetadata,
      ...settings,
    };

    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        metadata: updatedMetadata,
      },
    });

    revalidatePath("/settings/integrations");
    revalidatePath(`/integrations/${integrationId}`);

    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "Integration settings update error");
    if (isRedirectError(error)) throw error;
    return {
      success: false,
      message: "An error occurred while updating the integration settings",
    };
  }
}
export const updateIntegrationSettings = withLogging(
  "updateIntegrationSettings",
  _updateIntegrationSettings
);
