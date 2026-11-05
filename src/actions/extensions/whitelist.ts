// src/actions/extensions/whitelist.ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import type { ActionState } from "@/types";
import type {
  CreateWhitelistInput,
  ExtensionWhitelistItem,
  PaginatedResponse,
  PaginationParams,
  UpdateWhitelistInput,
} from "@/types/extension";
import {
  createWhitelistSchema,
  updateWhitelistSchema,
} from "@/types/extension";
import { revalidatePath } from "next/cache";

/**
 * Fetch the whitelist
 */
export async function getWhitelists(
  params: PaginationParams = {}
): Promise<ActionState<PaginatedResponse<ExtensionWhitelistItem>>> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }

    const { page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.extensionWhitelist.findMany({
        where: { organizationId: session.user.organizationId },
        orderBy: { addedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.extensionWhitelist.count({
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
    logger.error({ err: error }, "[getWhitelists] Error");
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch the whitelist",
    };
  }
}

/**
 * Create a whitelist entry
 */
async function _createWhitelist(
  input: CreateWhitelistInput
): Promise<ActionState<ExtensionWhitelistItem>> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }

    // Validate input
    const validation = createWhitelistSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || "Invalid input",
      };
    }

    const item = await prisma.extensionWhitelist.create({
      data: {
        organizationId: session.user.organizationId,
        pattern: input.pattern,
        name: input.name,
        source: input.source || "MANUAL",
        enabled: true,
      },
    });

    revalidatePath("/extensions/whitelist");
    return { success: true, data: item };
  } catch (error) {
    logger.error({ err: error }, "[createWhitelist] Error");
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create the whitelist entry",
    };
  }
}
export const createWhitelist = withLogging("createWhitelist", _createWhitelist);

/**
 * Update a whitelist entry
 */
async function _updateWhitelist(
  id: string,
  input: UpdateWhitelistInput
): Promise<ActionState<ExtensionWhitelistItem>> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }

    // Validate input
    const validation = updateWhitelistSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || "Invalid input",
      };
    }

    // Check the existing entry
    const existing = await prisma.extensionWhitelist.findUnique({
      where: { id },
    });

    if (!existing || existing.organizationId !== session.user.organizationId) {
      return { success: false, error: "Whitelist entry not found" };
    }

    const updated = await prisma.extensionWhitelist.update({
      where: { id },
      data: input,
    });

    revalidatePath("/extensions/whitelist");
    return { success: true, data: updated };
  } catch (error) {
    logger.error({ err: error }, "[updateWhitelist] Error");
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update the whitelist entry",
    };
  }
}
export const updateWhitelist = withLogging("updateWhitelist", _updateWhitelist);

/**
 * Delete a whitelist entry
 */
async function _deleteWhitelist(id: string): Promise<ActionState> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }

    // Check the existing entry
    const existing = await prisma.extensionWhitelist.findUnique({
      where: { id },
    });

    if (!existing || existing.organizationId !== session.user.organizationId) {
      return { success: false, error: "Whitelist entry not found" };
    }

    await prisma.extensionWhitelist.delete({
      where: { id },
    });

    revalidatePath("/extensions/whitelist");
    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "[deleteWhitelist] Error");
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete the whitelist entry",
    };
  }
}
export const deleteWhitelist = withLogging("deleteWhitelist", _deleteWhitelist);
