// src/actions/extensions/registered-apps.ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/service";
import { extractWildcardPattern } from "@/lib/utils/domain-extractor";
import type { ActionState } from "@/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Registered app list item type
 */
export type RegisteredAppItem = {
  id: string;
  appId: string;
  appName: string;
  logoUrl: string | null;
  category: string | null;
  website: string | null;
  pattern: string;
  isEnabled: boolean;
  source: "AUTO" | "MANUAL";
  registeredAt: Date;
};

/**
 * Registered app list response type
 */
export type RegisteredAppsResponse = {
  items: RegisteredAppItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/**
 * Fetch the registered app list
 * - Takes URLs from subscription-managed apps and shows them as whitelist patterns
 */
export async function getRegisteredApps(params: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<ActionState<RegisteredAppsResponse>> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }
    if (!(await can("extensions:read"))) {
      return {
        success: false,
        error: "You do not have permission to perform this action",
      };
    }

    const { page = 1, limit = 20, search } = params;
    const skip = (page - 1) * limit;

    // Fetch apps (only those with a URL)
    const whereClause = {
      organizationId: session.user.organizationId,
      status: "ACTIVE" as const,
      OR: [
        { customWebsite: { not: null } },
        { catalog: { website: { not: null } } },
      ],
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { customWebsite: { contains: search, mode: "insensitive" as const } },
          {
            catalog: {
              website: { contains: search, mode: "insensitive" as const },
            },
          },
        ],
      }),
    };

    const [apps, total] = await Promise.all([
      prisma.app.findMany({
        where: whereClause,
        include: {
          catalog: {
            select: {
              website: true,
              logoUrl: true,
            },
          },
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.app.count({ where: whereClause }),
    ]);

    // Fetch the existing whitelist (to match against app URLs)
    const whitelists = await prisma.extensionWhitelist.findMany({
      where: { organizationId: session.user.organizationId },
      select: { pattern: true, enabled: true, source: true },
    });

    const whitelistMap = new Map(
      whitelists.map((w) => [
        w.pattern,
        { enabled: w.enabled, source: w.source },
      ])
    );

    // Convert apps into registered app items
    const items: RegisteredAppItem[] = apps
      .map((app) => {
        const website = app.customWebsite || app.catalog?.website;
        if (!website) return null;

        const pattern = extractWildcardPattern(website);
        if (!pattern) return null;

        const whitelistInfo = whitelistMap.get(pattern);

        return {
          id: app.id,
          appId: app.id,
          appName: app.name,
          logoUrl: app.customLogoUrl || app.catalog?.logoUrl || null,
          category: app.category,
          website,
          pattern,
          isEnabled: whitelistInfo?.enabled ?? true,
          source: whitelistInfo?.source === "MANUAL" ? "MANUAL" : "AUTO",
          registeredAt: app.createdAt,
        } as RegisteredAppItem;
      })
      .filter((item): item is RegisteredAppItem => item !== null);

    return {
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[getRegisteredApps] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch registered apps",
    };
  }
}

/**
 * Sync registered apps to the whitelist
 * - Automatically adds subscription app URLs to the whitelist
 */
export async function syncRegisteredAppsToWhitelist(): Promise<
  ActionState<{ synced: number }>
> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }
    if (!(await can("extensions:manage"))) {
      return {
        success: false,
        error: "You do not have permission to perform this action",
      };
    }

    // Fetch URLs from active apps
    const apps = await prisma.app.findMany({
      where: {
        organizationId: session.user.organizationId,
        status: "ACTIVE",
        OR: [
          { customWebsite: { not: null } },
          { catalog: { website: { not: null } } },
        ],
      },
      include: {
        catalog: {
          select: { website: true },
        },
      },
    });

    let syncedCount = 0;

    for (const app of apps) {
      const website = app.customWebsite || app.catalog?.website;
      if (!website) continue;

      const pattern = extractWildcardPattern(website);
      if (!pattern) continue;

      // Check the existing whitelist
      const existing = await prisma.extensionWhitelist.findUnique({
        where: {
          organizationId_pattern: {
            organizationId: session.user.organizationId,
            pattern,
          },
        },
      });

      if (!existing) {
        // Add new
        await prisma.extensionWhitelist.create({
          data: {
            organizationId: session.user.organizationId,
            pattern,
            name: app.name,
            source: "ADMIN_IMPORT",
            enabled: true,
          },
        });
        syncedCount++;
      }
    }

    revalidatePath("/extensions/registered-apps");
    revalidatePath("/extensions/whitelist");

    return {
      success: true,
      data: { synced: syncedCount },
      message: `${syncedCount} apps synced to the whitelist.`,
    };
  } catch (error) {
    console.error("[syncRegisteredAppsToWhitelist] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Sync failed",
    };
  }
}

/**
 * Toggle a registered app on/off
 */
export async function toggleRegisteredAppStatus(
  appId: string,
  enabled: boolean
): Promise<ActionState> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }
    if (!(await can("extensions:manage"))) {
      return {
        success: false,
        error: "You do not have permission to perform this action",
      };
    }

    // Fetch the app
    const app = await prisma.app.findUnique({
      where: { id: appId },
      include: {
        catalog: { select: { website: true } },
      },
    });

    if (!app || app.organizationId !== session.user.organizationId) {
      return { success: false, error: "App not found" };
    }

    const website = app.customWebsite || app.catalog?.website;
    if (!website) {
      return { success: false, error: "The app has no URL" };
    }

    const pattern = extractWildcardPattern(website);
    if (!pattern) {
      return { success: false, error: "Invalid URL" };
    }

    // Update or create the whitelist entry
    await prisma.extensionWhitelist.upsert({
      where: {
        organizationId_pattern: {
          organizationId: session.user.organizationId,
          pattern,
        },
      },
      update: { enabled },
      create: {
        organizationId: session.user.organizationId,
        pattern,
        name: app.name,
        source: "ADMIN_IMPORT",
        enabled,
      },
    });

    revalidatePath("/extensions/registered-apps");
    revalidatePath("/extensions/whitelist");

    return {
      success: true,
      message: enabled ? "Enabled" : "Disabled",
    };
  } catch (error) {
    console.error("[toggleRegisteredAppStatus] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to change the status",
    };
  }
}

/**
 * Schema for manually adding a registered app (internal only: "use server" files may export only async functions)
 */
const addManualRegisteredAppSchema = z.object({
  name: z.string().min(1, "Please enter a name").max(100),
  pattern: z.string().min(1, "Please enter a domain pattern").max(255),
});

/**
 * Manually add a registered app
 */
export async function addManualRegisteredApp(input: {
  name: string;
  pattern: string;
}): Promise<ActionState> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }
    if (!(await can("extensions:manage"))) {
      return {
        success: false,
        error: "You do not have permission to perform this action",
      };
    }

    const validation = addManualRegisteredAppSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || "Invalid input",
      };
    }

    // Add to the whitelist
    await prisma.extensionWhitelist.create({
      data: {
        organizationId: session.user.organizationId,
        pattern: input.pattern,
        name: input.name,
        source: "MANUAL",
        enabled: true,
      },
    });

    revalidatePath("/extensions/registered-apps");
    revalidatePath("/extensions/whitelist");

    return { success: true, message: "Added" };
  } catch (error) {
    console.error("[addManualRegisteredApp] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add",
    };
  }
}

/**
 * Delete a registered app (removes it from the whitelist)
 */
export async function removeRegisteredApp(
  pattern: string
): Promise<ActionState> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }
    if (!(await can("extensions:manage"))) {
      return {
        success: false,
        error: "You do not have permission to perform this action",
      };
    }

    await prisma.extensionWhitelist.delete({
      where: {
        organizationId_pattern: {
          organizationId: session.user.organizationId,
          pattern,
        },
      },
    });

    revalidatePath("/extensions/registered-apps");
    revalidatePath("/extensions/whitelist");

    return { success: true, message: "Deleted" };
  } catch (error) {
    console.error("[removeRegisteredApp] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete",
    };
  }
}
