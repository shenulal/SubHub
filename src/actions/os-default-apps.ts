// src/actions/os-default-apps.ts
"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSaas } from "@/lib/deployment/mode";
import { withLogging } from "@/lib/logging";
import { can } from "@/lib/rbac/service";
import type { ActionState } from "@/types";
import type {
  CreateOsDefaultAppInput,
  OsDefaultAppRecord,
} from "@/types/dashboard2";
import type { DevicePlatform, OsDefaultApp } from "@prisma/client";

/**
 * List enabled OS default apps (per platform)
 */
export async function getOsDefaultApps(
  platform?: DevicePlatform
): Promise<OsDefaultAppRecord[]> {
  const apps = await prisma.osDefaultApp.findMany({
    where: {
      isActive: true,
      ...(platform && { platform }),
    },
    orderBy: { name: "asc" },
  });

  return apps.map((app) => ({
    id: app.id,
    name: app.name,
    bundleId: app.bundleId,
    namePattern: app.namePattern,
    platform: app.platform as OsDefaultAppRecord["platform"],
    category: app.category,
    description: app.description,
    isActive: app.isActive,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  }));
}

/**
 * Determine whether a DeviceApp is an OS default app
 *
 * Match priority:
 * 1. bundleId match (most accurate)
 * 2. namePattern regex match
 * 3. exact name match (case-insensitive)
 */
export function isOsDefaultApp(
  deviceApp: { name: string; bundleIdentifier?: string | null },
  osDefaultApps: OsDefaultApp[],
  platform: DevicePlatform
): boolean {
  const platformApps = osDefaultApps.filter((app) => app.platform === platform);

  for (const defaultApp of platformApps) {
    // Priority 1: bundleId match (most accurate)
    if (
      defaultApp.bundleId &&
      deviceApp.bundleIdentifier &&
      deviceApp.bundleIdentifier.toLowerCase() ===
        defaultApp.bundleId.toLowerCase()
    ) {
      return true;
    }

    // Priority 2: namePattern regex match
    if (defaultApp.namePattern) {
      try {
        const regex = new RegExp(defaultApp.namePattern, "i");
        if (regex.test(deviceApp.name)) {
          return true;
        }
      } catch {
        // Ignore invalid regular expressions
      }
    }

    // Priority 3: exact name match (case-insensitive)
    if (deviceApp.name.toLowerCase() === defaultApp.name.toLowerCase()) {
      return true;
    }
  }

  return false;
}

/**
 * Returns true if the app is an OS default app on any of the platforms
 */
export function checkIsOsDefault(
  app: { name: string; bundleIdentifier?: string | null },
  osDefaultApps: OsDefaultApp[],
  platforms: DevicePlatform[]
): boolean {
  return platforms.some((platform) =>
    isOsDefaultApp(app, osDefaultApps, platform)
  );
}

/**
 * OS default apps are a platform-wide list (no organisationId). Single-tenant:
 * the installation's ADMIN maintains it. SaaS: tenants must not change a list
 * every tenant shares, so tenant writes are refused (seeded/maintained by the
 * platform operator).
 */
async function osDefaultAppsWriteDenied(): Promise<string | null> {
  if (isSaas()) {
    return "OS default apps are shared by every tenant and are maintained by the platform operator.";
  }
  return (await can("catalog:manage"))
    ? null
    : "You do not have permission to edit OS default apps.";
}

/**
 * Create an OsDefaultApp (Admin only)
 */
async function _createOsDefaultApp(
  data: CreateOsDefaultAppInput
): Promise<ActionState<OsDefaultAppRecord>> {
  const session = await auth();

  if (!session?.user) {
    return { success: false, error: "Authentication required." };
  }

  const denied = await osDefaultAppsWriteDenied();
  if (denied) return { success: false, error: denied };

  try {
    const app = await prisma.osDefaultApp.create({
      data: {
        name: data.name,
        bundleId: data.bundleId,
        namePattern: data.namePattern,
        platform: data.platform,
        category: data.category,
        description: data.description,
      },
    });

    revalidatePath("/settings/os-default-apps");

    return {
      success: true,
      data: {
        id: app.id,
        name: app.name,
        bundleId: app.bundleId,
        namePattern: app.namePattern,
        platform: app.platform as OsDefaultAppRecord["platform"],
        category: app.category,
        description: app.description,
        isActive: app.isActive,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      },
    };
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return { success: false, error: "This app is already registered." };
    }
    return { success: false, error: "Failed to create the OS default app." };
  }
}
export const createOsDefaultApp = withLogging(
  "createOsDefaultApp",
  _createOsDefaultApp
);

/**
 * Update an OsDefaultApp (Admin only)
 */
async function _updateOsDefaultApp(
  id: string,
  data: Partial<CreateOsDefaultAppInput> & { isActive?: boolean }
): Promise<ActionState<OsDefaultAppRecord>> {
  const session = await auth();

  if (!session?.user) {
    return { success: false, error: "Authentication required." };
  }

  const denied = await osDefaultAppsWriteDenied();
  if (denied) return { success: false, error: denied };

  try {
    const app = await prisma.osDefaultApp.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.bundleId !== undefined && { bundleId: data.bundleId }),
        ...(data.namePattern !== undefined && {
          namePattern: data.namePattern,
        }),
        ...(data.platform && { platform: data.platform }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    revalidatePath("/settings/os-default-apps");

    return {
      success: true,
      data: {
        id: app.id,
        name: app.name,
        bundleId: app.bundleId,
        namePattern: app.namePattern,
        platform: app.platform as OsDefaultAppRecord["platform"],
        category: app.category,
        description: app.description,
        isActive: app.isActive,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      },
    };
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return { success: false, error: "App not found." };
    }
    return { success: false, error: "Failed to update the OS default app." };
  }
}
export const updateOsDefaultApp = withLogging(
  "updateOsDefaultApp",
  _updateOsDefaultApp
);

/**
 * Delete an OsDefaultApp (Admin only)
 */
async function _deleteOsDefaultApp(id: string): Promise<ActionState<void>> {
  const session = await auth();

  if (!session?.user) {
    return { success: false, error: "Authentication required." };
  }

  const denied = await osDefaultAppsWriteDenied();
  if (denied) return { success: false, error: denied };

  try {
    await prisma.osDefaultApp.delete({
      where: { id },
    });

    revalidatePath("/settings/os-default-apps");

    return { success: true };
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return { success: false, error: "App not found." };
    }
    return { success: false, error: "Failed to delete the OS default app." };
  }
}
export const deleteOsDefaultApp = withLogging(
  "deleteOsDefaultApp",
  _deleteOsDefaultApp
);
