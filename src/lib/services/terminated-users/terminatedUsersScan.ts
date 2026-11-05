// src/lib/services/terminated-users/terminatedUsersScan.ts
import { prisma } from "@/lib/db";
import { sendTerminatedUserAlertEmail } from "@/lib/services/notification/email";

// Organization settings type
interface OrganizationSettings {
  notifications?: {
    emailEnabled?: boolean;
    offboardingAlerts?: boolean;
  };
}

// Scan result type
export interface TerminatedUserScanResult {
  success: boolean;
  processedAt: Date;
  processedOrganizations: number;
  totalTerminatedUsers: number;
  totalUnrevokedAccess: number;
  emailsSent: number;
  errors: string[];
}

// Scans offboarded users with unrevoked accounts
export async function processTerminatedUsersScan(): Promise<TerminatedUserScanResult> {
  const result: TerminatedUserScanResult = {
    success: true,
    processedAt: new Date(),
    processedOrganizations: 0,
    totalTerminatedUsers: 0,
    totalUnrevokedAccess: 0,
    emailsSent: 0,
    errors: [],
  };

  try {
    // Load all organizations (including notification settings)
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        settings: true,
        users: {
          where: { role: "ADMIN", status: "ACTIVE" },
          select: { email: true, role: true },
        },
      },
    });

    result.processedOrganizations = organizations.length;

    for (const org of organizations) {
      try {
        await processOrganization(
          {
            id: org.id,
            name: org.name,
            settings: org.settings,
            members: org.users,
          },
          result
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        result.errors.push(`${org.id}: ${errorMessage}`);
      }
    }
  } catch (error) {
    result.success = false;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    result.errors.push(errorMessage);
  }

  return result;
}

// Process a single organization
async function processOrganization(
  org: {
    id: string;
    name: string;
    settings: unknown;
    members: Array<{ email: string; role: string }>;
  },
  result: TerminatedUserScanResult
): Promise<void> {
  const settings = org.settings as OrganizationSettings;
  const offboardingAlerts = settings?.notifications?.offboardingAlerts ?? true;
  const emailEnabled = settings?.notifications?.emailEnabled ?? true;

  // Find offboarded users who still have unrevoked access
  const terminatedUsers = await prisma.user.findMany({
    where: {
      organizationId: org.id,
      status: "TERMINATED",
      appAccesses: { some: {} },
    },
    include: {
      _count: {
        select: { appAccesses: true },
      },
      appAccesses: {
        include: {
          app: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (terminatedUsers.length === 0) {
    return;
  }

  result.totalTerminatedUsers += terminatedUsers.length;

  const totalAccess = terminatedUsers.reduce(
    (sum, user) => sum + user._count.appAccesses,
    0
  );
  result.totalUnrevokedAccess += totalAccess;

  // Skip when notifications are disabled
  if (!offboardingAlerts || !emailEnabled) {
    return;
  }

  // No admins
  const admins = org.members.filter((m) => m.role === "ADMIN");
  if (admins.length === 0) {
    result.errors.push(`${org.id}: No admin found`);
    return;
  }

  // Send an alert for each offboarded user
  for (const user of terminatedUsers) {
    const unrevokedApps = user.appAccesses.map((access) => access.app.name);

    for (const admin of admins) {
      const emailResult = await sendTerminatedUserAlertEmail({
        to: admin.email,
        terminatedUserName: user.name || user.email,
        terminatedUserEmail: user.email,
        unrevokedApps,
        terminatedAt: user.terminatedAt!,
        organizationName: org.name,
      });

      if (emailResult.success) {
        result.emailsSent++;
      } else {
        result.errors.push(
          `${org.id}/${user.id}: Email delivery failed - ${emailResult.error}`
        );
      }
    }
  }
}
