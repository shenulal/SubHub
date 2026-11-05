// FleetDM data sync service
import { prisma } from "@/lib/db";
import type { DevicePlatform, DeviceStatus, Prisma } from "@prisma/client";
import { FleetDMClient } from "./client";
import type { FleetDMHost, FleetDMSoftware } from "./types";
import { FLEETDM_PLATFORM_MAP, FLEETDM_STATUS_MAP } from "./types";

/**
 * Converts a FleetDM host to a SubHub Device
 */
function mapFleetDMHostToDevice(
  host: FleetDMHost,
  organizationId: string
): Prisma.DeviceCreateInput {
  return {
    organization: { connect: { id: organizationId } },
    fleetId: String(host.id),
    hostname: host.hostname || host.display_name,
    platform: (FLEETDM_PLATFORM_MAP[host.platform] ||
      "OTHER") as DevicePlatform,
    osVersion: host.os_version,
    hardwareModel: host.hardware_model,
    hardwareSerial: host.hardware_serial,
    status: (FLEETDM_STATUS_MAP[host.status] || "PENDING") as DeviceStatus,
    lastSeenAt: host.seen_time ? new Date(host.seen_time) : null,
    enrolledAt: host.last_enrolled_at ? new Date(host.last_enrolled_at) : null,
    agentVersion: host.osquery_version,
  };
}

/**
 * Converts FleetDM software to a SubHub DeviceApp
 */
function mapFleetDMSoftwareToDeviceApp(
  software: FleetDMSoftware,
  deviceId: string
): Prisma.DeviceAppCreateInput {
  return {
    device: { connect: { id: deviceId } },
    name: software.name,
    version: software.version,
    bundleIdentifier: software.bundle_identifier,
    approvalStatus: "UNKNOWN",
  };
}

/**
 * Syncs a single host
 */
export async function syncHostFromFleetDM(
  host: FleetDMHost,
  organizationId: string
): Promise<string> {
  const deviceData = mapFleetDMHostToDevice(host, organizationId);

  const device = await prisma.device.upsert({
    where: {
      organizationId_fleetId: {
        organizationId,
        fleetId: String(host.id),
      },
    },
    create: deviceData,
    update: {
      hostname: deviceData.hostname,
      platform: deviceData.platform,
      osVersion: deviceData.osVersion,
      hardwareModel: deviceData.hardwareModel,
      hardwareSerial: deviceData.hardwareSerial,
      status: deviceData.status,
      lastSeenAt: deviceData.lastSeenAt,
      agentVersion: deviceData.agentVersion,
      updatedAt: new Date(),
    },
  });

  return device.id;
}

/**
 * Syncs a host's software
 */
export async function syncHostSoftwareFromFleetDM(
  deviceId: string,
  software: FleetDMSoftware[]
): Promise<number> {
  // Load existing apps
  const existingApps = await prisma.deviceApp.findMany({
    where: { deviceId },
    select: { id: true, name: true, version: true },
  });

  const existingAppMap = new Map(
    existingApps.map((app) => [`${app.name}:${app.version}`, app.id])
  );

  let syncedCount = 0;

  for (const sw of software) {
    const key = `${sw.name}:${sw.version}`;
    const existingAppId = existingAppMap.get(key);

    if (existingAppId) {
      // Update the existing app
      await prisma.deviceApp.update({
        where: { id: existingAppId },
        data: {
          bundleIdentifier: sw.bundle_identifier,
          updatedAt: new Date(),
        },
      });
      existingAppMap.delete(key);
    } else {
      // Create a new app
      await prisma.deviceApp.create({
        data: mapFleetDMSoftwareToDeviceApp(sw, deviceId),
      });
    }
    syncedCount++;
  }

  // Delete apps no longer installed (optional)
  // Commented out: keep them instead of deleting
  // const removedAppIds = Array.from(existingAppMap.values());
  // if (removedAppIds.length > 0) {
  //   await prisma.deviceApp.deleteMany({
  //     where: { id: { in: removedAppIds } },
  //   });
  // }

  return syncedCount;
}

/**
 * Syncs DeviceApp to UserAppAccess
 * - When the device has a linked user
 * - and the DeviceApp has a matched app (matchedAppId)
 * - creates/updates the UserAppAccess record
 */
export async function syncUserAppAccessFromDevice(
  deviceId: string
): Promise<number> {
  // Check the user linked to the device
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { userId: true },
  });

  if (!device?.userId) {
    // No sync needed if no user is linked to the device
    return 0;
  }

  // Load DeviceApps with a matched app
  const deviceApps = await prisma.deviceApp.findMany({
    where: {
      deviceId,
      matchedAppId: { not: null },
    },
    select: {
      matchedAppId: true,
      lastUsedAt: true,
    },
  });

  let syncedCount = 0;

  for (const deviceApp of deviceApps) {
    if (!deviceApp.matchedAppId) continue;

    try {
      // UserAppAccess upsert
      await prisma.userAppAccess.upsert({
        where: {
          userId_appId: {
            userId: device.userId,
            appId: deviceApp.matchedAppId,
          },
        },
        create: {
          userId: device.userId,
          appId: deviceApp.matchedAppId,
          source: "FLEET_DM",
          lastUsedAt: deviceApp.lastUsedAt,
        },
        update: {
          // Update to the more recent lastUsedAt
          lastUsedAt: deviceApp.lastUsedAt,
          updatedAt: new Date(),
        },
      });
      syncedCount++;
    } catch (error) {
      // Ignore errors such as duplicates and continue
      console.error(
        `UserAppAccess sync failed for app ${deviceApp.matchedAppId}:`,
        error
      );
    }
  }

  return syncedCount;
}

/**
 * Full sync (batch)
 */
export async function syncAllFromFleetDM(
  client: FleetDMClient,
  organizationId: string,
  options?: {
    syncSoftware?: boolean;
    syncUserAppAccess?: boolean;
    onProgress?: (current: number, total: number) => void;
  }
): Promise<{
  hostsSync: number;
  softwareSync: number;
  userAppAccessSync: number;
  errors: string[];
}> {
  const {
    syncSoftware = true,
    syncUserAppAccess = true,
    onProgress,
  } = options ?? {};
  const errors: string[] = [];

  // 1. Fetch hosts
  const hosts = await client.getHosts({ perPage: 1000 });
  let hostsSync = 0;
  let softwareSync = 0;
  let userAppAccessSync = 0;

  // 2. Sync each host
  for (let i = 0; i < hosts.length; i++) {
    const host = hosts[i];

    try {
      const deviceId = await syncHostFromFleetDM(host, organizationId);
      hostsSync++;

      // 3. Sync software (optional)
      if (syncSoftware) {
        try {
          const software = await client.getHostSoftware(host.id, {
            perPage: 500,
          });
          const count = await syncHostSoftwareFromFleetDM(deviceId, software);
          softwareSync += count;
        } catch (err) {
          errors.push(
            `Software sync failed for host ${host.id}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      // 4. Sync UserAppAccess (optional)
      if (syncUserAppAccess) {
        try {
          const count = await syncUserAppAccessFromDevice(deviceId);
          userAppAccessSync += count;
        } catch (err) {
          errors.push(
            `UserAppAccess sync failed for host ${host.id}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    } catch (err) {
      errors.push(
        `Host sync failed for ${host.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Progress callback
    onProgress?.(i + 1, hosts.length);
  }

  return {
    hostsSync,
    softwareSync,
    userAppAccessSync,
    errors,
  };
}

/**
 * Creates a FleetDM client from integration settings
 */
export async function getFleetDMClientFromIntegration(
  integrationId: string
): Promise<FleetDMClient | null> {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration || integration.type !== "FLEETDM") {
    return null;
  }

  const credentials = integration.credentials as {
    baseUrl?: string;
    apiToken?: string;
    teamId?: number;
  };

  if (!credentials.baseUrl || !credentials.apiToken) {
    return null;
  }

  return new FleetDMClient({
    baseUrl: credentials.baseUrl,
    apiToken: credentials.apiToken,
    teamId: credentials.teamId,
  });
}

/**
 * Gets the client from the organization's FleetDM integration
 */
export async function getFleetDMClientForOrganization(
  organizationId: string
): Promise<FleetDMClient | null> {
  const integration = await prisma.integration.findFirst({
    where: {
      organizationId,
      type: "FLEETDM",
      status: "ACTIVE",
    },
  });

  if (!integration) {
    return null;
  }

  return getFleetDMClientFromIntegration(integration.id);
}
