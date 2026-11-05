// src/actions/saas-review.ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import type { ActionState } from "@/types";
import { AppStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export interface PendingApp {
  id: string;
  name: string;
  catalogName: string | null;
  catalogId: string | null;
  createdAt: Date;
}

export interface InferenceLogItem {
  id: string;
  merchantName: string;
  suggestedName: string | null;
  confidence: number;
  isSaaS: boolean;
  createdAt: Date;
  matchTarget: string | null;
}

export interface SaasReviewStats {
  totalLogs: number;
  saasLogs: number;
  nonSaasLogs: number;
  avgConfidence: number;
}

export interface SaasReviewData {
  pendingApps: PendingApp[];
  logs: InferenceLogItem[];
  stats: SaasReviewStats;
}

async function requireAdminSession() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    throw new Error("Authentication required");
  }
  if (session.user.role !== "ADMIN") {
    throw new Error("Only admins can access this");
  }
  return session.user;
}

export async function getSaasReviewData(): Promise<SaasReviewData> {
  const user = await requireAdminSession();

  const [pendingApps, logs, totalLogs, saasLogs, nonSaasLogs] =
    await Promise.all([
      prisma.app.findMany({
        where: {
          organizationId: user.organizationId!,
          status: AppStatus.PENDING_REVIEW,
        },
        include: { catalog: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.vendorInferenceLog.findMany({
        where: { organizationId: user.organizationId! },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.vendorInferenceLog.count({
        where: { organizationId: user.organizationId! },
      }),
      prisma.vendorInferenceLog.count({
        where: { organizationId: user.organizationId!, isSaaS: true },
      }),
      prisma.vendorInferenceLog.count({
        where: { organizationId: user.organizationId!, isSaaS: false },
      }),
    ]);

  const avgConfidence =
    logs.length === 0
      ? 0
      : Number(
          (
            logs.reduce((sum, log) => sum + (log.confidence ?? 0), 0) /
            logs.length
          ).toFixed(2)
        );

  return {
    pendingApps: pendingApps.map((app) => ({
      id: app.id,
      name: app.name,
      catalogName: app.catalog?.name || null,
      catalogId: app.catalogId,
      createdAt: app.createdAt,
    })),
    logs: logs.map((log) => ({
      id: log.id,
      merchantName: log.merchantName,
      suggestedName: log.suggestedName,
      confidence: log.confidence,
      isSaaS: log.isSaaS,
      createdAt: log.createdAt,
      matchTarget: log.catalogId || log.appId || null,
    })),
    stats: {
      totalLogs,
      saasLogs,
      nonSaasLogs,
      avgConfidence,
    },
  };
}

async function _approvePendingApp(appId: string): Promise<ActionState> {
  try {
    const user = await requireAdminSession();

    const app = await prisma.app.findFirst({
      where: { id: appId, organizationId: user.organizationId! },
    });
    if (!app) {
      return { success: false, message: "App not found" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.app.update({
        where: { id: appId },
        data: { status: AppStatus.ACTIVE },
      });

      if (app.catalogId) {
        await tx.saaSCatalog.update({
          where: { id: app.catalogId },
          data: { isVerified: true },
        });
      }
    });

    revalidatePath("/settings/saas-review");
    return { success: true, message: "The app has been approved" };
  } catch (error) {
    logger.error({ err: error }, "App approval failed");
    return {
      success: false,
      message: "An error occurred while approving the app",
    };
  }
}
export const approvePendingApp = withLogging(
  "approvePendingApp",
  _approvePendingApp
);

async function _rejectPendingApp(appId: string): Promise<ActionState> {
  try {
    const user = await requireAdminSession();

    const app = await prisma.app.findFirst({
      where: { id: appId, organizationId: user.organizationId! },
    });
    if (!app) {
      return { success: false, message: "App not found" };
    }

    await prisma.app.update({
      where: { id: appId },
      data: { status: AppStatus.BLOCKED },
    });

    revalidatePath("/settings/saas-review");
    return { success: true, message: "The app has been blocked" };
  } catch (error) {
    logger.error({ err: error }, "App block failed");
    return {
      success: false,
      message: "An error occurred while blocking the app",
    };
  }
}
export const rejectPendingApp = withLogging(
  "rejectPendingApp",
  _rejectPendingApp
);
