// src/actions/extensions/devices.ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { can } from "@/lib/rbac/service";
import type { ActionState } from "@/types";
import type {
  ExtensionDeviceDetail,
  ExtensionDeviceItem,
  PaginatedResponse,
  PaginationParams,
  UpdateDeviceStatusInput,
} from "@/types/extension";
import { updateDeviceStatusSchema } from "@/types/extension";
import { revalidatePath } from "next/cache";

/**
 * Fetch the extension device list
 */
export async function getExtensionDevices(
  params: PaginationParams & { status?: string } = {}
): Promise<ActionState<PaginatedResponse<ExtensionDeviceDetail>>> {
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

    const { page = 1, limit = 20, status } = params;
    const skip = (page - 1) * limit;

    const where = {
      organizationId: session.user.organizationId,
      ...(status && {
        status: status as "PENDING" | "APPROVED" | "REVOKED" | "INACTIVE",
      }),
    };

    const [items, total] = await Promise.all([
      prisma.extensionDevice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.extensionDevice.count({ where }),
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
    logger.error({ err: error }, "[getExtensionDevices] Error");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch devices",
    };
  }
}

/**
 * Fetch extension device details
 */
export async function getExtensionDevice(
  id: string
): Promise<ActionState<ExtensionDeviceDetail>> {
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

    const device = await prisma.extensionDevice.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!device || device.organizationId !== session.user.organizationId) {
      return { success: false, error: "Device not found" };
    }

    return { success: true, data: device };
  } catch (error) {
    logger.error({ err: error }, "[getExtensionDevice] Error");
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch the device",
    };
  }
}

/**
 * Update extension device status
 */
async function _updateExtensionDeviceStatus(
  id: string,
  input: UpdateDeviceStatusInput
): Promise<ActionState<ExtensionDeviceItem>> {
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
    const validation = updateDeviceStatusSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || "Invalid input",
      };
    }

    // Check the existing entry
    const existing = await prisma.extensionDevice.findUnique({
      where: { id },
    });

    if (!existing || existing.organizationId !== session.user.organizationId) {
      return { success: false, error: "Device not found" };
    }

    const updated = await prisma.extensionDevice.update({
      where: { id },
      data: { status: input.status },
    });

    revalidatePath("/extensions/devices");
    return { success: true, data: updated };
  } catch (error) {
    logger.error({ err: error }, "[updateExtensionDeviceStatus] Error");
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update the device status",
    };
  }
}
export const updateExtensionDeviceStatus = withLogging(
  "updateExtensionDeviceStatus",
  _updateExtensionDeviceStatus
);

/**
 * Sync an extension device (updates lastSeenAt)
 */
async function _syncExtensionDevice(
  id: string
): Promise<ActionState<ExtensionDeviceItem>> {
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
    const existing = await prisma.extensionDevice.findUnique({
      where: { id },
    });

    if (!existing || existing.organizationId !== session.user.organizationId) {
      return { success: false, error: "Device not found" };
    }

    const updated = await prisma.extensionDevice.update({
      where: { id },
      data: { lastSeenAt: new Date() },
    });

    revalidatePath("/extensions/devices");
    return { success: true, data: updated };
  } catch (error) {
    logger.error({ err: error }, "[syncExtensionDevice] Error");
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to sync the device",
    };
  }
}
export const syncExtensionDevice = withLogging(
  "syncExtensionDevice",
  _syncExtensionDevice
);

/**
 * Check whether the current user has the extension installed
 * Checks ExtensionDevice for a record with the current userId and status=APPROVED
 */
export async function checkExtensionInstalled(): Promise<
  ActionState<{ installed: boolean }>
> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId || !session?.user?.id) {
      return { success: false, error: "Authentication required" };
    }

    const device = await prisma.extensionDevice.findFirst({
      where: {
        userId: session.user.id,
        organizationId: session.user.organizationId,
        status: "APPROVED",
      },
      select: { id: true },
    });

    return { success: true, data: { installed: !!device } };
  } catch (error) {
    logger.error({ err: error }, "[checkExtensionInstalled] Error");
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to check the extension installation",
    };
  }
}
