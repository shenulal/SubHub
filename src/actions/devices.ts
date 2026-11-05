// src/actions/devices.ts
"use server";

import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import {
  getDeviceById,
  getDevices,
  getDeviceStats,
  getShadowITApps,
  getUsersWithoutAgent,
  updateDeviceAppApprovalStatus,
  type DeviceFilterOptions,
  type DeviceListResult,
  type DeviceStats,
  type DeviceWithApps,
  type ShadowITAppSummary,
} from "@/lib/services/fleetdm";
import type { ActionState } from "@/types";
import type { DeviceAppApprovalStatus } from "@prisma/client";

/**
 * Server Action: list devices
 */
export async function fetchDevices(
  options: DeviceFilterOptions = {}
): Promise<ActionState<DeviceListResult>> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }

    const result = await getDevices(session.user.organizationId, options);
    return { success: true, data: result };
  } catch (error) {
    logger.error({ err: error }, "[fetchDevices] Error");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch devices",
    };
  }
}

/**
 * Server Action: get device details
 */
export async function fetchDeviceById(
  deviceId: string
): Promise<ActionState<DeviceWithApps>> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }

    const device = await getDeviceById(deviceId, session.user.organizationId);
    if (!device) {
      return { success: false, error: "Device not found" };
    }

    return { success: true, data: device };
  } catch (error) {
    logger.error({ err: error }, "[fetchDeviceById] Error");
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch the device",
    };
  }
}

/**
 * Server Action: get device statistics
 */
export async function fetchDeviceStats(): Promise<ActionState<DeviceStats>> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }

    const stats = await getDeviceStats(session.user.organizationId);
    return { success: true, data: stats };
  } catch (error) {
    logger.error({ err: error }, "[fetchDeviceStats] Error");
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to load statistics",
    };
  }
}

/**
 * Server Action: list Shadow IT apps
 */
export async function fetchShadowITApps(): Promise<
  ActionState<ShadowITAppSummary[]>
> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }

    const apps = await getShadowITApps(session.user.organizationId);
    return { success: true, data: apps };
  } catch (error) {
    logger.error({ err: error }, "[fetchShadowITApps] Error");
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load Shadow IT apps",
    };
  }
}

/**
 * Server Action: change app approval status (Admin only)
 */
async function _setDeviceAppApprovalStatus(
  appName: string,
  status: DeviceAppApprovalStatus
): Promise<ActionState<{ updatedCount: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }

    // Only Admin can change app approval status
    if (session.user.role !== "ADMIN") {
      return { success: false, error: "Permission denied" };
    }

    const result = await updateDeviceAppApprovalStatus(
      session.user.organizationId,
      appName,
      status
    );

    return { success: true, data: { updatedCount: result.updatedCount } };
  } catch (error) {
    logger.error({ err: error }, "[setDeviceAppApprovalStatus] Error");
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to change the status",
    };
  }
}
export const setDeviceAppApprovalStatus = withLogging(
  "setDeviceAppApprovalStatus",
  _setDeviceAppApprovalStatus
);

/**
 * Server Action: list users without the agent installed
 */
export async function fetchUsersWithoutAgent(): Promise<
  ActionState<{ id: string; name: string | null; email: string }[]>
> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }

    const users = await getUsersWithoutAgent(session.user.organizationId);
    return { success: true, data: users };
  } catch (error) {
    logger.error({ err: error }, "[fetchUsersWithoutAgent] Error");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load users",
    };
  }
}
