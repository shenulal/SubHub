// src/actions/integrations-read.ts
"use server";

/**
 * Integration read Server Actions
 */

import { getCachedSession } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { inFilter } from "@/lib/filters/multi-value";
import type { ActionState } from "@/types";
import type { IntegrationMetadata, IntegrationWithStats } from "@/types/sso";
import type { Integration } from "@prisma/client";
import { redirect } from "next/navigation";

import { can } from "@/lib/rbac/service";
import type { GetIntegrationsParams, SyncLogEntry } from "./integrations.types";

/**
 * List integrations
 * Called directly from pages, so redirects on authentication failure
 */
export async function getIntegrations(
  params: GetIntegrationsParams = {}
): Promise<{
  items: Integration[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const session = await getCachedSession();
  if (!session?.user?.organizationId) {
    redirect("/login");
  }
  if (!(await can("integrations:read"))) {
    throw new Error("You do not have permission to perform this action");
  }

  const {
    filter = {},
    sort = { sortBy: "createdAt", sortOrder: "desc" },
    page = 1,
    limit = 20,
  } = params;
  const skip = (page - 1) * limit;
  const statuses = inFilter(
    filter.status === undefined
      ? undefined
      : Array.isArray(filter.status)
        ? filter.status
        : [filter.status]
  );

  const where = {
    organizationId: session.user.organizationId,
    ...(statuses ? { status: statuses } : {}),
    ...(filter.type ? { type: filter.type as Integration["type"] } : {}),
    ...(filter.search
      ? { metadata: { path: ["domain"], string_contains: filter.search } }
      : {}),
  };

  const orderBy = sort.sortBy
    ? { [sort.sortBy]: sort.sortOrder || "desc" }
    : { createdAt: "desc" as const };

  const [items, total] = await Promise.all([
    prisma.integration.findMany({
      where,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.integration.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get a single integration (with statistics)
 * - Responds with ActionState on authentication/permission failure
 */
export async function getIntegration(
  integrationId: string
): Promise<ActionState<{ integration: IntegrationWithStats }>> {
  const session = await getCachedSession();
  if (!session?.user?.organizationId) {
    return { success: false, message: "Authentication required" };
  }
  if (!(await can("integrations:read"))) {
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

  // Fetch sync statistics
  const [syncCount, lastSync] = await Promise.all([
    prisma.syncLog.count({
      where: { integrationId },
    }),
    prisma.syncLog.findFirst({
      where: { integrationId },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  return {
    success: true,
    data: {
      integration: {
        ...integration,
        metadata: integration.metadata as IntegrationMetadata,
        syncCount,
        lastSyncResult: lastSync
          ? {
              status: lastSync.status,
              itemsFound: lastSync.itemsFound,
              itemsCreated: lastSync.itemsCreated,
              itemsUpdated: lastSync.itemsUpdated,
              errors:
                (lastSync.errors as { code: string; message: string }[]) || [],
            }
          : undefined,
      },
    },
  };
}

/**
 * Get sync logs
 */
export async function getSyncLogs(
  integrationId: string,
  limit: number = 10
): Promise<ActionState<{ logs: SyncLogEntry[] }>> {
  const session = await getCachedSession();
  if (!session?.user?.organizationId) {
    return { success: false, message: "Authentication required" };
  }
  if (!(await can("integrations:read"))) {
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

  const logs = await prisma.syncLog.findMany({
    where: { integrationId },
    orderBy: { startedAt: "desc" },
    take: limit,
  });

  // Serialize Dates as ISO strings
  return {
    success: true,
    data: {
      logs: logs.map((log) => ({
        id: log.id,
        status: log.status as SyncLogEntry["status"],
        itemsFound: log.itemsFound,
        itemsCreated: log.itemsCreated,
        itemsUpdated: log.itemsUpdated,
        errors: log.errors as SyncLogEntry["errors"],
        startedAt: log.startedAt.toISOString(),
        completedAt: log.completedAt?.toISOString() ?? null,
      })),
    },
  };
}
