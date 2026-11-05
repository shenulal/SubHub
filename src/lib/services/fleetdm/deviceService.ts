// src/lib/services/fleetdm/deviceService.ts
import { prisma } from "@/lib/db";
import type {
  Device,
  DeviceApp,
  DeviceAppApprovalStatus,
  DevicePlatform,
  DeviceStatus,
} from "@prisma/client";

// Device + relations type
export type DeviceWithApps = Device & {
  user: { id: string; name: string | null; email: string } | null;
  deviceApps: (DeviceApp & {
    matchedApp: { id: string; name: string } | null;
  })[];
};

export type DeviceListItem = Device & {
  user: { id: string; name: string | null; email: string } | null;
  _count: { deviceApps: number };
};

// Device statistics type
export interface DeviceStats {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  pendingDevices: number;
  totalApps: number;
  shadowITApps: number;
  installationRate: number; // Agent installation rate (0-1)
}

// Shadow IT app summary type
export interface ShadowITAppSummary {
  name: string;
  deviceCount: number;
  firstSeenAt?: Date;
  lastSeenAt?: Date;
}

// Filter options
export interface DeviceFilterOptions {
  status?: DeviceStatus;
  platform?: DevicePlatform;
  userId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// Pagination result
export interface DeviceListResult {
  devices: DeviceListItem[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Lists the organization's devices
 */
export async function getDevices(
  organizationId: string,
  options: DeviceFilterOptions = {}
): Promise<DeviceListResult> {
  const { status, platform, userId, search, page = 1, limit = 20 } = options;

  const where = {
    organizationId,
    ...(status && { status }),
    ...(platform && { platform }),
    ...(userId && { userId }),
    ...(search && {
      OR: [
        { hostname: { contains: search, mode: "insensitive" as const } },
        { hardwareSerial: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [devices, total] = await Promise.all([
    prisma.device.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { deviceApps: true },
        },
      },
      orderBy: { lastSeenAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.device.count({ where }),
  ]);

  return {
    devices: devices as DeviceListItem[],
    total,
    page,
    limit,
  };
}

/**
 * Gets device details (including apps)
 */
export async function getDeviceById(
  deviceId: string,
  organizationId: string
): Promise<DeviceWithApps | null> {
  const device = await prisma.device.findUnique({
    where: { id: deviceId, organizationId },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      deviceApps: {
        include: {
          matchedApp: {
            select: { id: true, name: true },
          },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  return device as DeviceWithApps | null;
}

/**
 * Gets device statistics
 */
export async function getDeviceStats(
  organizationId: string
): Promise<DeviceStats> {
  const [
    totalDevices,
    onlineDevices,
    offlineDevices,
    pendingDevices,
    totalApps,
    shadowITApps,
  ] = await Promise.all([
    prisma.device.count({ where: { organizationId } }),
    prisma.device.count({ where: { organizationId, status: "ONLINE" } }),
    prisma.device.count({ where: { organizationId, status: "OFFLINE" } }),
    prisma.device.count({ where: { organizationId, status: "PENDING" } }),
    prisma.deviceApp.count({
      where: { device: { organizationId } },
    }),
    prisma.deviceApp.count({
      where: {
        device: { organizationId },
        approvalStatus: "SHADOW_IT",
      },
    }),
  ]);

  // Installation rate: (online + offline) / total
  // PENDING devices are treated as not installed
  const installedDevices = onlineDevices + offlineDevices;
  const installationRate =
    totalDevices > 0 ? installedDevices / totalDevices : 0;

  return {
    totalDevices,
    onlineDevices,
    offlineDevices,
    pendingDevices,
    totalApps,
    shadowITApps,
    installationRate,
  };
}

/**
 * Lists apps installed on a device
 */
export async function getDeviceApps(
  deviceId: string
): Promise<
  (DeviceApp & { matchedApp: { id: string; name: string } | null })[]
> {
  const apps = await prisma.deviceApp.findMany({
    where: { deviceId },
    include: {
      matchedApp: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ approvalStatus: "asc" }, { name: "asc" }],
  });

  return apps;
}

/**
 * Lists the organization's Shadow IT apps (grouped)
 */
export async function getShadowITApps(
  organizationId: string
): Promise<ShadowITAppSummary[]> {
  const groupedApps = await prisma.deviceApp.groupBy({
    by: ["name"],
    where: {
      device: { organizationId },
      approvalStatus: "SHADOW_IT",
    },
    _count: { _all: true },
  });

  return groupedApps.map((group) => ({
    name: group.name,
    deviceCount: group._count._all,
  }));
}

/**
 * Bulk-updates app approval status (by app name)
 */
export async function updateDeviceAppApprovalStatus(
  organizationId: string,
  appName: string,
  status: DeviceAppApprovalStatus
): Promise<{ success: boolean; updatedCount: number }> {
  // Find the app installed on the organization's devices
  const appsToUpdate = await prisma.deviceApp.findMany({
    where: {
      name: appName,
      device: { organizationId },
    },
    select: { id: true, deviceId: true },
  });

  if (appsToUpdate.length === 0) {
    return { success: true, updatedCount: 0 };
  }

  // Bulk update in a transaction
  await prisma.$transaction(
    appsToUpdate.map((app) =>
      prisma.deviceApp.update({
        where: { id: app.id },
        data: { approvalStatus: status },
      })
    )
  );

  return { success: true, updatedCount: appsToUpdate.length };
}

/**
 * Lists users without the agent installed
 */
export async function getUsersWithoutAgent(
  organizationId: string
): Promise<{ id: string; name: string | null; email: string }[]> {
  // Get IDs of users with linked devices
  const devicesWithUsers = await prisma.device.findMany({
    where: {
      organizationId,
      userId: { not: null },
      status: { not: "RETIRED" },
    },
    select: { userId: true },
  });

  const usersWithDevices = new Set(
    devicesWithUsers.map((d) => d.userId).filter(Boolean)
  );

  // Find active users without devices
  const usersWithoutAgent = await prisma.user.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      id: { notIn: Array.from(usersWithDevices) as string[] },
    },
    select: { id: true, name: true, email: true },
  });

  return usersWithoutAgent;
}
