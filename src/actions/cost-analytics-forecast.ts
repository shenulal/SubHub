// src/actions/cost-analytics-forecast.ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ActionState } from "@/types";
import type {
  CostAnomaly,
  DetectCostAnomaliesResult,
  ForecastResult,
  GetForecastedCostResult,
  SubscriptionForecast,
} from "@/types/cost-analytics";
import type { AnomalyKpiData } from "@/types/dashboard";
import {
  applyPaymentRecordScope,
  resolveReportScope,
} from "./cost-analytics-scope";
import {
  calculateMonthlyCost,
  extractAmount,
  formatDisplayLabel,
  formatMonthKey,
  getSeverity,
} from "./cost-analytics-utils";

/**
 * Cost anomaly detection
 * Detects apps whose cost rose 50% or more versus last month
 */
export async function detectCostAnomalies(
  options: {
    teamId?: string;
    userId?: string;
  } = {}
): Promise<ActionState<DetectCostAnomaliesResult>> {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, message: "Authentication required" };
    }

    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }

    // Calculate the current and previous month dates
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const scope = resolveReportScope(options, session.user);

    const currentWhere: Record<string, unknown> = {
      organizationId: session.user.organizationId,
      matchStatus: { in: ["MANUAL", "AUTO_MATCHED"] },
      matchedAppId: { not: null },
      transactionDate: { gte: currentMonthStart },
    };
    applyPaymentRecordScope(currentWhere, scope);

    // Per-app cost for the current month
    const currentMonthData = await prisma.paymentRecord.groupBy({
      by: ["matchedAppId"],
      where: currentWhere,
      _sum: { amount: true },
    });

    // Per-app cost for the previous month
    const previousWhere: Record<string, unknown> = {
      organizationId: session.user.organizationId,
      matchStatus: { in: ["MANUAL", "AUTO_MATCHED"] },
      matchedAppId: { not: null },
      transactionDate: { gte: previousMonthStart, lte: previousMonthEnd },
    };
    applyPaymentRecordScope(previousWhere, scope);

    const previousMonthData = await prisma.paymentRecord.groupBy({
      by: ["matchedAppId"],
      where: previousWhere,
      _sum: { amount: true },
    });

    // Convert previous-month data to a Map
    const previousCostMap = new Map<string, number>();
    previousMonthData.forEach((item) => {
      if (item.matchedAppId) {
        previousCostMap.set(item.matchedAppId, extractAmount(item._sum.amount));
      }
    });

    // Fetch app info
    const appIds = currentMonthData
      .map((g) => g.matchedAppId)
      .filter((id): id is string => id !== null);

    const apps = await prisma.app.findMany({
      where: { id: { in: appIds } },
      select: { id: true, name: true },
    });

    const appMap = new Map(apps.map((app) => [app.id, app.name]));

    // Detect anomalies
    const anomalies: CostAnomaly[] = [];

    currentMonthData.forEach((item) => {
      if (!item.matchedAppId) return;

      const currentCost = extractAmount(item._sum.amount);
      const previousCost = previousCostMap.get(item.matchedAppId) || 0;

      // Previous-month cost exists and rose by 50% or more
      if (previousCost > 0) {
        const changeRate = ((currentCost - previousCost) / previousCost) * 100;

        if (changeRate >= 50) {
          const severity = getSeverity(changeRate);
          anomalies.push({
            appId: item.matchedAppId,
            appName: appMap.get(item.matchedAppId) || "Unknown",
            currentCost,
            previousCost,
            changeRate: Math.round(changeRate),
            severity,
            message: `Up ${Math.round(changeRate)}% vs last month`,
          });
        }
      }
    });

    // Sort by severity
    anomalies.sort((a, b) => b.changeRate - a.changeRate);

    return {
      success: true,
      data: {
        anomalies,
        hasAnomalies: anomalies.length > 0,
      },
    };
  } catch (error) {
    console.error("Cost anomaly detection error:", error);
    return {
      success: false,
      message: "An error occurred while detecting cost anomalies",
    };
  }
}

/**
 * Get the cost forecast
 * Calculates next month's expected cost from subscription data
 */
export async function getForecastedCost(options: {
  targetMonth?: string; // YYYY-MM format
}): Promise<ActionState<GetForecastedCostResult>> {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, message: "Authentication required" };
    }

    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }

    // Determine the target month (default: next month)
    const now = new Date();
    let targetMonth = options.targetMonth;
    if (!targetMonth) {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      targetMonth = formatMonthKey(nextMonth);
    }

    // Calculate the target month's start/end dates
    const [year, month] = targetMonth.split("-").map(Number);
    const targetMonthStart = new Date(year, month - 1, 1);
    const targetMonthEnd = new Date(year, month, 0);

    // Fetch active subscriptions
    const subscriptions = await prisma.subscription.findMany({
      where: {
        organizationId: session.user.organizationId,
        status: "ACTIVE",
      },
      include: {
        app: { select: { name: true } },
      },
    });

    // Calculate forecast cost per subscription
    const subscriptionBreakdown: SubscriptionForecast[] = [];
    let forecastedCost = 0;

    subscriptions.forEach((sub) => {
      let monthlyCost: number;

      // PER_SEAT subscriptions use usedLicenses * perSeatPrice for a more accurate forecast
      if (
        sub.billingType === "PER_SEAT" &&
        sub.perSeatPrice !== null &&
        sub.usedLicenses !== null &&
        sub.usedLicenses > 0
      ) {
        const price =
          sub.perSeatPrice &&
          typeof sub.perSeatPrice === "object" &&
          "toNumber" in sub.perSeatPrice
            ? (sub.perSeatPrice as { toNumber: () => number }).toNumber()
            : Number(sub.perSeatPrice ?? 0);
        monthlyCost = sub.usedLicenses * price;
      } else {
        monthlyCost = calculateMonthlyCost(sub);
      }

      forecastedCost += monthlyCost;

      subscriptionBreakdown.push({
        subscriptionId: sub.id,
        appName: sub.app.name,
        expectedCost: monthlyCost,
        billingCycle: sub.billingCycle as "MONTHLY" | "YEARLY" | "QUARTERLY",
        nextRenewalDate: sub.renewalDate,
      });
    });

    // Actual payment records for that month (if any)
    const actualPayments = await prisma.paymentRecord.aggregate({
      where: {
        organizationId: session.user.organizationId,
        matchStatus: { in: ["MANUAL", "AUTO_MATCHED"] },
        transactionDate: { gte: targetMonthStart, lte: targetMonthEnd },
      },
      _sum: { amount: true },
    });

    const actualCost = extractAmount(actualPayments._sum.amount);
    const variance = actualCost > 0 ? actualCost - forecastedCost : undefined;
    const variancePercentage =
      actualCost > 0 && forecastedCost > 0
        ? Math.round(((actualCost - forecastedCost) / forecastedCost) * 100)
        : undefined;

    const forecast: ForecastResult = {
      targetMonth,
      displayLabel: formatDisplayLabel(targetMonth),
      forecastedCost,
      actualCost: actualCost > 0 ? actualCost : undefined,
      variance,
      variancePercentage,
      subscriptionBreakdown,
    };

    return {
      success: true,
      data: { forecast },
    };
  } catch (error) {
    console.error("Cost forecast error:", error);
    return {
      success: false,
      message: "An error occurred while loading the cost forecast",
    };
  }
}

/**
 * Cost anomaly summary (for the Dashboard V3 KPI card)
 * Wraps detectCostAnomalies() and returns a simplified result
 */
export async function getCostAnomalies(): Promise<ActionState<AnomalyKpiData>> {
  try {
    const result = await detectCostAnomalies();

    if (!result.success || !result.data) {
      return {
        success: false,
        message: result.message || "Cost anomaly detection failed",
      };
    }

    const { anomalies } = result.data;
    const count = anomalies.length;

    // Severity: high (5 or more), medium (3–4), low (1–2)
    let severity: "low" | "medium" | "high";
    if (count >= 5) {
      severity = "high";
    } else if (count >= 3) {
      severity = "medium";
    } else {
      severity = "low";
    }

    return {
      success: true,
      data: { count, severity },
    };
  } catch (error) {
    console.error("Cost anomaly summary error:", error);
    return {
      success: false,
      message: "An error occurred while summarizing cost anomalies",
    };
  }
}
