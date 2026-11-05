// FleetDM integration creation and sync test
// Run: npx tsx scripts/test-fleetdm-sync.ts

import { prisma } from "../src/lib/db";
import { FleetDMClient } from "../src/lib/services/fleetdm/client";
import { syncAllFromFleetDM } from "../src/lib/services/fleetdm/sync";

// Credentials come from the environment — never commit a FleetDM API token.
const FLEETDM_URL = process.env.FLEETDM_API_URL ?? "http://localhost:8080";
const FLEETDM_TOKEN = process.env.FLEETDM_API_TOKEN ?? "";

async function main() {
  console.log("=== FleetDM Integration Setup ===\n");

  if (!FLEETDM_TOKEN) {
    console.error("Set FLEETDM_API_TOKEN (and FLEETDM_API_URL) first.");
    process.exit(1);
  }

  // 1. Find or create the organisation (ORG_ID selects one explicitly; required in SaaS mode)
  if (!process.env.ORG_ID && process.env.SUBHUB_DEPLOYMENT_MODE === "saas") {
    console.error(
      "SUBHUB_DEPLOYMENT_MODE=saas: set ORG_ID to choose the tenant."
    );
    process.exit(1);
  }
  let org = process.env.ORG_ID
    ? await prisma.organization.findUnique({
        where: { id: process.env.ORG_ID },
      })
    : await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });

  if (!org) {
    console.log("Creating test organization...");
    org = await prisma.organization.create({
      data: {
        name: "Test Organization",
        slug: "test-org",
        plan: "ENTERPRISE",
      },
    });
    console.log("✅ Created organization:", org.id);
  } else {
    console.log("✅ Found organization:", org.id, org.name);
  }

  // 2. Find or create the FleetDM integration
  let integration = await prisma.integration.findFirst({
    where: {
      organizationId: org.id,
      type: "FLEETDM",
    },
  });

  if (!integration) {
    console.log("Creating FleetDM integration...");
    integration = await prisma.integration.create({
      data: {
        organizationId: org.id,
        type: "FLEETDM",
        status: "ACTIVE",
        credentials: {
          baseUrl: FLEETDM_URL,
          apiToken: FLEETDM_TOKEN,
        },
      },
    });
    console.log("✅ Created FleetDM integration:", integration.id);
  } else {
    // Update credentials
    integration = await prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: "ACTIVE",
        credentials: {
          baseUrl: FLEETDM_URL,
          apiToken: FLEETDM_TOKEN,
        },
      },
    });
    console.log("✅ Updated FleetDM integration:", integration.id);
  }

  // 3. Test the FleetDM client connection
  console.log("\nTesting FleetDM connection...");
  const client = new FleetDMClient({
    baseUrl: FLEETDM_URL,
    apiToken: FLEETDM_TOKEN,
  });

  const isConnected = await client.testConnection();
  console.log("✅ FleetDM connected:", isConnected);

  if (!isConnected) {
    console.error("❌ Cannot connect to FleetDM server");
    process.exit(1);
  }

  // 4. Run the sync
  console.log("\n=== Running Sync ===\n");

  const result = await syncAllFromFleetDM(client, org.id, {
    syncSoftware: true,
    onProgress: (current, total) => {
      console.log(`Progress: ${current}/${total}`);
    },
  });

  console.log("\n=== Sync Result ===");
  console.log("Hosts synced:", result.hostsSync);
  console.log("Software synced:", result.softwareSync);
  console.log("Errors:", result.errors.length);

  if (result.errors.length > 0) {
    console.log("\nErrors:");
    result.errors.forEach((e) => console.log(" -", e));
  }

  // 5. Check the synced devices
  const devices = await prisma.device.findMany({
    where: { organizationId: org.id },
    include: {
      deviceApps: {
        take: 15,
        orderBy: { name: "asc" },
        where: {
          name: {
            endsWith: ".app",
          },
        },
      },
    },
  });

  console.log("\n=== Synced Devices ===");
  console.log("Total devices:", devices.length);

  for (const device of devices) {
    console.log("\nDevice:", device.hostname);
    console.log("  Fleet ID:", device.fleetId);
    console.log("  Platform:", device.platform);
    console.log("  Status:", device.status);
    console.log("  OS Version:", device.osVersion);
    console.log("  Hardware Model:", device.hardwareModel);
    console.log("  Serial:", device.hardwareSerial);
    console.log("  Last Seen:", device.lastSeenAt);
    console.log("  DeviceApps (sample macOS apps):", device.deviceApps.length);
    device.deviceApps.forEach((app) => {
      console.log("    -", app.name, app.version || "");
    });
  }

  // 6. DeviceApp statistics
  const totalApps = await prisma.deviceApp.count();
  const appsByStatus = await prisma.deviceApp.groupBy({
    by: ["approvalStatus"],
    _count: true,
  });

  console.log("\n=== DeviceApp Stats ===");
  console.log("Total DeviceApps:", totalApps);
  appsByStatus.forEach((stat) => {
    console.log(" ", stat.approvalStatus + ":", stat._count);
  });

  // 7. Update the integration status
  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      lastSyncAt: new Date(),
    },
  });

  console.log("\n✅ Sync completed successfully!");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
