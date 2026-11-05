// src/lib/services/cost/costAnomalyScan.ts
import { prisma } from "@/lib/db";
import { getBaseCurrency } from "@/lib/fx/base-currency";
import { sendCostAnomalyAlertEmail } from "@/lib/services/notification/securityAlert";
import { getSetting } from "@/lib/settings/service";

// Organization settings type
interface OrganizationSettings {
  notifications?: {
    emailEnabled?: boolean;
    costAnomalyAlerts?: boolean;
  };
}

// Scan result type
export interface CostAnomalyScanResult {
  success: boolean;
  processedAt: Date;
  processedOrganizations: number;
  anomaliesFound: number;
  emailsSent: number;
  errors: string[];
}

// Monthly cost aggregation result
interface MonthlyCost {
  appId: string;
  appName: string;
  previousMonthCost: number;
  currentMonthCost: number;
  percentageChange: number;
}

/**
 * Runs the cost anomaly scan
 * - Calculates the month-over-month cost increase
 * - E-mails admins when the threshold is exceeded
 */
export async function processCostAnomalyScan(): Promise<CostAnomalyScanResult> {
  const result: CostAnomalyScanResult = {
    success: true,
    processedAt: new Date(),
    processedOrganizations: 0,
    anomaliesFound: 0,
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
          select: { id: true, email: true },
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
            adminEmails: org.users.map((u) => u.email),
            admins: org.users,
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
    adminEmails: string[];
    admins: Array<{ id: string; email: string }>;
  },
  result: CostAnomalyScanResult
): Promise<void> {
  const settings = org.settings as OrganizationSettings;
  const costAnomalyAlerts = settings?.notifications?.costAnomalyAlerts ?? true;
  const emailEnabled = settings?.notifications?.emailEnabled ?? true;
  // Threshold lives on the settings registry (admin section of /settings/notifications)
  const threshold = await getSetting(
    org.id,
    "discovery.costAnomalyThresholdPercent"
  );

  // Skip when notifications are disabled
  if (!costAnomalyAlerts || !emailEnabled) {
    return;
  }

  // No admins
  if (org.adminEmails.length === 0) {
    result.errors.push(`${org.id}: No admin found`);
    return;
  }

  // Aggregate monthly costs
  const anomalies = await calculateMonthlyCostAnomalies(org.id, threshold);

  if (anomalies.length === 0) {
    return;
  }

  result.anomaliesFound += anomalies.length;

  // E-mail admins for each app with a detected anomaly
  for (const anomaly of anomalies) {
    const currentMonth = new Date();
    const previousMonth = new Date();
    previousMonth.setMonth(previousMonth.getMonth() - 1);

    const period = `${previousMonth.toLocaleString("en-US", { month: "short", year: "numeric" })} → ${currentMonth.toLocaleString("en-US", { month: "short", year: "numeric" })}`;

    const baseCurrency = await getBaseCurrency(org.id);
    for (const admin of org.admins) {
      const adminEmail = admin.email;
      const emailResult = await sendCostAnomalyAlertEmail({
        to: adminEmail,
        organizationId: org.id,
        recipientUserId: admin.id,
        organizationName: org.name,
        appName: anomaly.appName,
        previousCost: anomaly.previousMonthCost,
        currentCost: anomaly.currentMonthCost,
        percentageIncrease: Math.round(anomaly.percentageChange),
        currency: baseCurrency,
        period,
      });

      if (emailResult.success) {
        result.emailsSent++;
      } else {
        result.errors.push(
          `${org.id}/${anomaly.appId}: Email delivery failed (${adminEmail}) - ${emailResult.error}`
        );
      }
    }
  }
}

// Calculate monthly cost anomalies
async function calculateMonthlyCostAnomalies(
  organizationId: string,
  threshold: number
): Promise<MonthlyCost[]> {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Aggregate this month's costs (based on approvals)
  const currentMonthCosts = await prisma.cardTransaction.groupBy({
    by: ["matchedAppId"],
    where: {
      organizationId,
      matchedAppId: { not: null },
      transactionType: "APPROVAL", // Query approvals only
      createdAt: { gte: currentMonthStart },
    },
    _sum: { useAmt: true },
  });

  // Aggregate last month's costs (based on approvals)
  const previousMonthCosts = await prisma.cardTransaction.groupBy({
    by: ["matchedAppId"],
    where: {
      organizationId,
      matchedAppId: { not: null },
      transactionType: "APPROVAL", // Query approvals only
      createdAt: {
        gte: previousMonthStart,
        lte: previousMonthEnd,
      },
    },
    _sum: { useAmt: true },
  });

  // Look up app names
  const appIds = [
    ...new Set([
      ...currentMonthCosts
        .map((c) => c.matchedAppId)
        .filter((id): id is string => id !== null),
      ...previousMonthCosts
        .map((c) => c.matchedAppId)
        .filter((id): id is string => id !== null),
    ]),
  ];

  const apps = await prisma.app.findMany({
    where: { id: { in: appIds } },
    select: { id: true, name: true },
  });
  const appNameMap = new Map(apps.map((a) => [a.id, a.name]));

  // Previous-month cost map (Decimal converted to number)
  const previousCostMap = new Map(
    previousMonthCosts.map((c) => [c.matchedAppId, Number(c._sum.useAmt) || 0])
  );

  // Detect anomalies
  const anomalies: MonthlyCost[] = [];

  for (const current of currentMonthCosts) {
    if (!current.matchedAppId) continue;

    const currentCost = Number(current._sum.useAmt) || 0;
    const previousCost = previousCostMap.get(current.matchedAppId) || 0;

    // Skip when last month's cost is 0 (new app)
    if (previousCost === 0) continue;

    const percentageChange =
      ((currentCost - previousCost) / previousCost) * 100;

    // Treat as an anomaly when the threshold is exceeded
    if (percentageChange >= threshold) {
      anomalies.push({
        appId: current.matchedAppId,
        appName: appNameMap.get(current.matchedAppId) || "Unknown app",
        previousMonthCost: previousCost,
        currentMonthCost: currentCost,
        percentageChange,
      });
    }
  }

  return anomalies;
}
