// src/actions/super-admin/extension-builds.ts
"use server";

import { requireSuperAdmin } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { writePlatformAudit } from "@/lib/platform-audit";
import type { ActionState } from "@/types";
import { revalidatePath } from "next/cache";
import { resolveConsoleTenant } from "./_tenant";

export interface ExtensionBuildSummary {
  id: string;
  version: string;
  platform: string;
  status: string;
  downloadUrl: string | null;
  fileSize: number | null;
  createdAt: Date;
  completedAt: Date | null;
  isLatest: boolean;
}

/**
 * Fetch the current tenant's extension builds
 * @param input.organizationId - Tenant ID to query (required in SaaS mode; single-tenant defaults to the only organisation)
 */
async function _listExtensionBuilds(input?: {
  organizationId?: string;
}): Promise<ActionState<ExtensionBuildSummary[]>> {
  await requireSuperAdmin();

  const resolved = await resolveConsoleTenant(input?.organizationId);
  if (!resolved.ok) return { success: false, message: resolved.message };
  const org = resolved.tenant;

  const builds = await prisma.extensionBuild.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Find the latest COMPLETED build ID
  const latestCompleted = builds.find((b) => b.status === "COMPLETED");

  return {
    success: true,
    data: builds.map((build) => ({
      id: build.id,
      version: build.version,
      platform: build.platform,
      status: build.status,
      downloadUrl: build.downloadUrl,
      fileSize: build.fileSize,
      createdAt: build.createdAt,
      completedAt: build.completedAt,
      isLatest: build.id === latestCompleted?.id,
    })),
  };
}

export const listExtensionBuilds = withLogging(
  "listExtensionBuilds",
  _listExtensionBuilds
);

/**
 * Trigger an extension build
 * @param input.organizationId - Tenant ID to build for (required in SaaS mode; single-tenant defaults to the only organisation)
 */
async function _triggerExtensionBuild(input?: {
  organizationId?: string;
}): Promise<ActionState<{ buildId: string; version: string }>> {
  const { userId } = await requireSuperAdmin();

  const resolved = await resolveConsoleTenant(input?.organizationId);
  if (!resolved.ok) return { success: false, message: resolved.message };
  const org = resolved.tenant;

  // Compute the version (latest build version + 1)
  const latestBuild = await prisma.extensionBuild.findFirst({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
    select: { version: true },
  });

  let nextVersion = "1.0.0";
  if (latestBuild?.version) {
    const parts = latestBuild.version.split(".").map(Number);
    parts[2] = (parts[2] ?? 0) + 1;
    nextVersion = parts.join(".");
  }

  // 1. Create the PENDING record first
  const build = await prisma.extensionBuild.create({
    data: {
      organizationId: org.id,
      version: nextVersion,
      platform: "CHROME",
      status: "PENDING",
    },
  });

  await writePlatformAudit({
    actorId: userId,
    action: "TRIGGER_EXTENSION_BUILD",
    entityType: "ExtensionBuild",
    entityId: build.id,
    changes: { version: nextVersion, platform: "CHROME" },
    metadata: { organizationId: org.id },
  });

  // 2. Call the correct endpoint with x-internal-secret auth (fire-and-forget)
  // Internal calls use localhost (calling the external URL from inside the pod causes DNS/TLS issues)
  const internalSecret = process.env.AUTH_SECRET || "dev-secret-123";
  const baseUrl = `http://localhost:${process.env.PORT || 3000}`;

  fetch(`${baseUrl}/api/v1/extensions/builds/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": internalSecret,
    },
    body: JSON.stringify({
      buildId: build.id,
      version: nextVersion,
      organizationId: org.id,
    }),
  }).catch((err) => {
    logger.error({ err }, "[triggerExtensionBuild] Background build error");
    prisma.extensionBuild
      .update({
        where: { id: build.id },
        data: { status: "FAILED", errorMessage: "Build request failed" },
      })
      .catch(() => {});
  });

  // 3. Return success immediately (fire-and-forget)
  revalidatePath("/super-admin/extension-builds");
  return {
    success: true,
    message: `Build started. (v${nextVersion})`,
    data: { buildId: build.id, version: nextVersion },
  };
}

export const triggerExtensionBuild = withLogging(
  "triggerExtensionBuild",
  _triggerExtensionBuild
);
