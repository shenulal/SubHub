// src/actions/extensions/blacklist.ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { can } from "@/lib/rbac/service";
import type { ActionState } from "@/types";
import type {
  CreateBlacklistInput,
  ExtensionBlacklistItem,
  PaginatedResponse,
  PaginationParams,
  UpdateBlacklistInput,
} from "@/types/extension";
import {
  createBlacklistSchema,
  updateBlacklistSchema,
} from "@/types/extension";
import { revalidatePath } from "next/cache";

/**
 * Fetch the blacklist
 */
export async function getBlacklists(
  params: PaginationParams = {}
): Promise<ActionState<PaginatedResponse<ExtensionBlacklistItem>>> {
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

    const { page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.extensionBlacklist.findMany({
        where: { organizationId: session.user.organizationId },
        orderBy: { addedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.extensionBlacklist.count({
        where: { organizationId: session.user.organizationId },
      }),
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
    logger.error({ err: error }, "[getBlacklists] Error");
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch the blacklist",
    };
  }
}

/**
 * Create a blacklist entry
 */
async function _createBlacklist(
  input: CreateBlacklistInput
): Promise<ActionState<ExtensionBlacklistItem>> {
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
    const validation = createBlacklistSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || "Invalid input",
      };
    }

    const item = await prisma.extensionBlacklist.create({
      data: {
        organizationId: session.user.organizationId,
        pattern: input.pattern,
        name: input.name,
        reason: input.reason,
        enabled: true,
      },
    });

    revalidatePath("/extensions/blacklist");
    return { success: true, data: item };
  } catch (error) {
    logger.error({ err: error }, "[createBlacklist] Error");
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create the blacklist entry",
    };
  }
}
export const createBlacklist = withLogging("createBlacklist", _createBlacklist);

/**
 * Update a blacklist entry
 */
async function _updateBlacklist(
  id: string,
  input: UpdateBlacklistInput
): Promise<ActionState<ExtensionBlacklistItem>> {
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
    const validation = updateBlacklistSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || "Invalid input",
      };
    }

    // Check the existing entry
    const existing = await prisma.extensionBlacklist.findUnique({
      where: { id },
    });

    if (!existing || existing.organizationId !== session.user.organizationId) {
      return { success: false, error: "Blacklist entry not found" };
    }

    const updated = await prisma.extensionBlacklist.update({
      where: { id },
      data: input,
    });

    revalidatePath("/extensions/blacklist");
    return { success: true, data: updated };
  } catch (error) {
    logger.error({ err: error }, "[updateBlacklist] Error");
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update the blacklist entry",
    };
  }
}
export const updateBlacklist = withLogging("updateBlacklist", _updateBlacklist);

/**
 * Delete a blacklist entry
 */
async function _deleteBlacklist(id: string): Promise<ActionState> {
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
    const existing = await prisma.extensionBlacklist.findUnique({
      where: { id },
    });

    if (!existing || existing.organizationId !== session.user.organizationId) {
      return { success: false, error: "Blacklist entry not found" };
    }

    await prisma.extensionBlacklist.delete({
      where: { id },
    });

    revalidatePath("/extensions/blacklist");
    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "[deleteBlacklist] Error");
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete the blacklist entry",
    };
  }
}
export const deleteBlacklist = withLogging("deleteBlacklist", _deleteBlacklist);
