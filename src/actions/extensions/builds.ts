// src/actions/extensions/builds.ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { can } from "@/lib/rbac/service";
import type { ActionState } from "@/types";
import type {
  ExtensionBuildItem,
  PaginatedResponse,
  PaginationParams,
  TriggerBuildInput,
} from "@/types/extension";
import { triggerBuildSchema } from "@/types/extension";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

/**
 * Run the build process (via an API route)
 * child_process has bundling issues in Server Actions, so it lives in an API route
 */
async function executeBuildProcess(
  buildId: string,
  version: string
): Promise<void> {
  try {
    // Read cookies (to forward auth credentials)
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Internal self-calls use localhost (bypasses CloudFront/WAF)
    const baseUrl = `http://localhost:${process.env.PORT || 3000}`;
    const response = await fetch(
      `${baseUrl}/api/v1/extensions/builds/execute`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        body: JSON.stringify({ buildId, version }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      logger.error({ err: error }, "[executeBuildProcess] API Error");
    }
  } catch (error) {
    logger.error({ err: error }, "[executeBuildProcess] Error");
    await prisma.extensionBuild.update({
      where: { id: buildId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage:
          error instanceof Error ? error.message : "Build execution failed",
      },
    });
  }
}

/**
 * Fetch the build list
 */
export async function getBuilds(
  params: PaginationParams & { status?: string; platform?: string } = {}
): Promise<ActionState<PaginatedResponse<ExtensionBuildItem>>> {
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

    const { page = 1, limit = 20, status, platform } = params;
    const skip = (page - 1) * limit;

    const where = {
      organizationId: session.user.organizationId,
      ...(status && {
        status: status as "PENDING" | "BUILDING" | "COMPLETED" | "FAILED",
      }),
      ...(platform && {
        platform: platform as
          | "CHROME"
          | "WINDOWS_EXE"
          | "WINDOWS_MSI"
          | "MAC_PKG"
          | "MAC_DMG",
      }),
    };

    const [items, total] = await Promise.all([
      prisma.extensionBuild.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.extensionBuild.count({ where }),
    ]);

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
    logger.error({ err: error }, "[getBuilds] Error");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch builds",
    };
  }
}

/**
 * Fetch build details
 */
export async function getBuild(
  id: string
): Promise<ActionState<ExtensionBuildItem>> {
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

    const build = await prisma.extensionBuild.findUnique({
      where: { id },
    });

    if (!build || build.organizationId !== session.user.organizationId) {
      return { success: false, error: "Build not found" };
    }

    return { success: true, data: build };
  } catch (error) {
    logger.error({ err: error }, "[getBuild] Error");
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch the build",
    };
  }
}

/**
 * Trigger a new build
 */
async function _triggerBuild(
  input: TriggerBuildInput & { version?: string }
): Promise<ActionState<ExtensionBuildItem>> {
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

    // Validate input
    const validation = triggerBuildSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || "Invalid input",
      };
    }

    // Only the CHROME platform is supported for now
    if (input.platform !== "CHROME") {
      return {
        success: false,
        error: "Only Chrome extension builds are currently supported",
      };
    }

    // Look up the latest build version
    const latestBuild = await prisma.extensionBuild.findFirst({
      where: {
        organizationId: session.user.organizationId,
        platform: input.platform,
      },
      orderBy: { createdAt: "desc" },
    });

    // Auto-increment the version (1.0.0 if none)
    let version = input.version;
    if (!version) {
      if (latestBuild?.version) {
        const parts = latestBuild.version.split(".");
        const patch = parseInt(parts[2] || "0", 10) + 1;
        version = `${parts[0]}.${parts[1]}.${patch}`;
      } else {
        version = "1.0.0";
      }
    }

    const build = await prisma.extensionBuild.create({
      data: {
        organizationId: session.user.organizationId,
        version,
        platform: input.platform,
        status: "PENDING",
      },
    });

    // Run the build in the background (fire-and-forget)
    executeBuildProcess(build.id, version).catch((err) => {
      logger.error({ err }, "[triggerBuild] Background build error");
    });

    revalidatePath("/extensions/builds");
    return { success: true, data: build };
  } catch (error) {
    logger.error({ err: error }, "[triggerBuild] Error");
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to trigger the build",
    };
  }
}
export const triggerBuild = withLogging("triggerBuild", _triggerBuild);

/**
 * Delete a build
 */
async function _deleteBuild(id: string): Promise<ActionState> {
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

    // Check the existing entry
    const existing = await prisma.extensionBuild.findUnique({
      where: { id },
    });

    if (!existing || existing.organizationId !== session.user.organizationId) {
      return { success: false, error: "Build not found" };
    }

    // Builds in progress cannot be deleted
    if (existing.status === "BUILDING") {
      return { success: false, error: "A build in progress cannot be deleted" };
    }

    await prisma.extensionBuild.delete({
      where: { id },
    });

    revalidatePath("/extensions/builds");
    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "[deleteBuild] Error");
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete the build",
    };
  }
}
export const deleteBuild = withLogging("deleteBuild", _deleteBuild);

/**
 * Retry a failed build
 */
async function _retryBuild(
  id: string
): Promise<ActionState<ExtensionBuildItem>> {
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

    // Check the existing entry
    const existing = await prisma.extensionBuild.findUnique({
      where: { id },
    });

    if (!existing || existing.organizationId !== session.user.organizationId) {
      return { success: false, error: "Build not found" };
    }

    // Only failed builds can be retried
    if (existing.status !== "FAILED") {
      return { success: false, error: "Only failed builds can be retried" };
    }

    const updated = await prisma.extensionBuild.update({
      where: { id },
      data: {
        status: "PENDING",
        errorMessage: null,
        buildLog: null,
      },
    });

    // Run the build in the background (fire-and-forget)
    executeBuildProcess(updated.id, existing.version).catch((err) => {
      logger.error({ err }, "[retryBuild] Background build error");
    });

    revalidatePath("/extensions/builds");
    return { success: true, data: updated };
  } catch (error) {
    logger.error({ err: error }, "[retryBuild] Error");
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to retry the build",
    };
  }
}
export const retryBuild = withLogging("retryBuild", _retryBuild);

/**
 * Extension deployment settings type
 */
export type ExtensionDeployMethod = "auto" | "webstore" | "manual";

export interface ExtensionDeploySettings {
  extensionDeployMethod: ExtensionDeployMethod;
  extensionWebstoreUrl: string;
}

/**
 * Fetch extension deployment settings
 */
export async function getExtensionDeploySettings(): Promise<
  ActionState<ExtensionDeploySettings>
> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }

    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { settings: true },
    });

    const settings = (org?.settings as Record<string, unknown> | null) ?? {};

    return {
      success: true,
      data: {
        extensionDeployMethod:
          (settings.extensionDeployMethod as ExtensionDeployMethod) || "manual",
        extensionWebstoreUrl: (settings.extensionWebstoreUrl as string) || "",
      },
    };
  } catch (error) {
    logger.error({ err: error }, "[getExtensionDeploySettings] Error");
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch deployment settings",
    };
  }
}

/**
 * Update extension deployment settings
 */
async function _updateExtensionDeploySettings(input: {
  extensionDeployMethod: ExtensionDeployMethod;
  extensionWebstoreUrl?: string;
}): Promise<ActionState> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }

    // Check admin permission
    if (!(await can("extensions:manage"))) {
      return {
        success: false,
        error: "Only admins can change deployment settings",
      };
    }

    // Validation
    const validMethods: ExtensionDeployMethod[] = [
      "auto",
      "webstore",
      "manual",
    ];
    if (!validMethods.includes(input.extensionDeployMethod)) {
      return { success: false, error: "Invalid deployment method" };
    }

    if (
      input.extensionDeployMethod === "webstore" &&
      !input.extensionWebstoreUrl?.trim()
    ) {
      return {
        success: false,
        error: "Please enter the Chrome Web Store URL",
      };
    }

    // Read current settings, then merge
    const current = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { settings: true },
    });
    const currentSettings =
      (current?.settings as Record<string, unknown> | null) ?? {};

    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: {
        settings: {
          ...currentSettings,
          extensionDeployMethod: input.extensionDeployMethod,
          extensionWebstoreUrl:
            input.extensionDeployMethod === "webstore"
              ? input.extensionWebstoreUrl?.trim() || ""
              : currentSettings.extensionWebstoreUrl || "",
        },
      },
    });

    revalidatePath("/extensions/builds");
    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "[updateExtensionDeploySettings] Error");
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update deployment settings",
    };
  }
}
export const updateExtensionDeploySettings = withLogging(
  "updateExtensionDeploySettings",
  _updateExtensionDeploySettings
);

/**
 * Auto-create the initial build (when none exists at login)
 * Callable from the JWT callback - uses prisma directly without cookies()
 */
export async function triggerInitialBuild(
  organizationId: string
): Promise<void> {
  try {
    const build = await prisma.extensionBuild.create({
      data: {
        organizationId,
        version: "1.0.0",
        platform: "CHROME",
        status: "PENDING",
      },
    });

    // Internal self-calls use localhost (bypasses CloudFront/WAF)
    const baseUrl = `http://localhost:${process.env.PORT || 3000}`;
    const internalSecret = process.env.AUTH_SECRET || "dev-secret-123";

    fetch(`${baseUrl}/api/v1/extensions/builds/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": internalSecret,
      },
      body: JSON.stringify({
        buildId: build.id,
        version: "1.0.0",
        organizationId,
      }),
    }).catch((err) => {
      logger.error({ err }, "[triggerInitialBuild] Background build error");
    });
  } catch (error) {
    logger.error({ err: error }, "[triggerInitialBuild] Error");
  }
}

/**
 * Fetch the latest completed build (for download in manual deployment)
 */
export async function getLatestBuild(): Promise<
  ActionState<ExtensionBuildItem | null>
> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }

    const build = await prisma.extensionBuild.findFirst({
      where: {
        organizationId: session.user.organizationId,
        status: "COMPLETED",
        platform: "CHROME",
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: build || null };
  } catch (error) {
    logger.error({ err: error }, "[getLatestBuild] Error");
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch the latest build",
    };
  }
}
