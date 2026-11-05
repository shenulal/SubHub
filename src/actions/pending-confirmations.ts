// src/actions/pending-confirmations.ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { sendConfirmationResultEmail } from "@/lib/services/notification/email";
import { normalizeMerchantName } from "@/lib/services/payment/merchant-matcher";
import type { ActionState } from "@/types";
import { AppStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

/**
 * Items needing confirmation (LLM inference results with 50–80% confidence)
 */
export interface PendingConfirmationItem {
  id: string;
  merchantName: string;
  normalizedName: string | null;
  confidence: number;
  suggestedName: string | null;
  category: string | null;
  website: string | null;
  reasoning: string | null;
  createdAt: Date;
  appId: string | null;
  appName: string | null;
  appStatus: string | null;
}

export interface PendingConfirmationsData {
  items: PendingConfirmationItem[];
  total: number;
}

const CONFIDENCE_MIN = 0.5;
const CONFIDENCE_MAX = 0.8;

async function requireSession() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { error: "Authentication required" };
  }
  return { user: session.user };
}

async function requireAdminSession() {
  const result = await requireSession();
  if ("error" in result) return result;
  if (result.user.role !== "ADMIN") {
    return { error: "Only admins can confirm this" };
  }
  return result;
}

/**
 * Get items needing confirmation (50–80% confidence)
 * - Apps with isSaaS: true in PENDING_REVIEW status
 * - confidence in the 0.5–0.8 range
 */
export async function getPendingConfirmations(
  limit = 10
): Promise<ActionState<PendingConfirmationsData>> {
  const sessionResult = await requireSession();
  if ("error" in sessionResult) {
    return { success: false, message: sessionResult.error };
  }

  const { user } = sessionResult;

  try {
    const whereClause = {
      organizationId: user.organizationId!,
      confidence: { gte: CONFIDENCE_MIN, lte: CONFIDENCE_MAX },
      isSaaS: true,
      app: { status: AppStatus.PENDING_REVIEW },
    };

    const [logs, total] = await Promise.all([
      prisma.vendorInferenceLog.findMany({
        where: whereClause,
        include: {
          app: {
            select: { id: true, name: true, status: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.vendorInferenceLog.count({ where: whereClause }),
    ]);

    const items: PendingConfirmationItem[] = logs.map((log) => ({
      id: log.id,
      merchantName: log.merchantName,
      normalizedName: log.normalizedName,
      confidence: log.confidence,
      suggestedName: log.suggestedName,
      category: log.category,
      website: log.website,
      reasoning: log.reasoning,
      createdAt: log.createdAt,
      appId: log.appId,
      appName: log.app?.name ?? null,
      appStatus: log.app?.status ?? null,
    }));

    return {
      success: true,
      data: { items, total },
    };
  } catch (error) {
    logger.error({ err: error }, "Failed to load items needing confirmation");
    return {
      success: false,
      message: "An error occurred while loading items needing confirmation",
    };
  }
}

/**
 * Confirm as SaaS (approve)
 * - Sets the app status to ACTIVE
 */
async function _confirmAsSaaS(appId: string): Promise<ActionState> {
  const sessionResult = await requireAdminSession();
  if ("error" in sessionResult) {
    return { success: false, message: sessionResult.error };
  }

  const { user } = sessionResult;

  try {
    // Verify app ownership
    const app = await prisma.app.findFirst({
      where: { id: appId, organizationId: user.organizationId! },
    });

    if (!app) {
      return { success: false, message: "App not found" };
    }

    await prisma.app.update({
      where: { id: appId },
      data: { status: AppStatus.ACTIVE },
    });

    await sendConfirmationEmail({
      organizationId: user.organizationId!,
      appName: app.name,
      action: "approved",
      confidence: null,
      normalizedName: null,
      actorEmail: user.email ?? null,
    });

    revalidatePath("/");
    revalidatePath("/settings/saas-review");

    return {
      success: true,
      message: `"${app.name}" has been approved as SaaS`,
    };
  } catch (error) {
    logger.error({ err: error }, "SaaS approval failed");
    return {
      success: false,
      message: "An error occurred while approving as SaaS",
    };
  }
}
export const confirmAsSaaS = withLogging("confirmAsSaaS", _confirmAsSaaS);

/**
 * Confirm as non-SaaS (reject)
 * - Sets the app status to BLOCKED
 * - Adds it to the NonSaaSVendor cache
 */
async function _confirmAsNonSaaS(
  appId: string,
  normalizedName: string
): Promise<ActionState> {
  const sessionResult = await requireAdminSession();
  if ("error" in sessionResult) {
    return { success: false, message: sessionResult.error };
  }

  const { user } = sessionResult;

  try {
    // Verify app ownership
    const app = await prisma.app.findFirst({
      where: { id: appId, organizationId: user.organizationId! },
    });

    if (!app) {
      return { success: false, message: "App not found" };
    }

    // Block the app and register it in the non-SaaS cache in one transaction
    await prisma.$transaction(async (tx) => {
      await tx.app.update({
        where: { id: appId },
        data: { status: AppStatus.BLOCKED },
      });

      // Add to the non-SaaS cache
      const normalized = normalizedName || normalizeMerchantName(app.name);
      await tx.nonSaaSVendor.upsert({
        where: {
          organizationId_normalizedName: {
            organizationId: user.organizationId!,
            normalizedName: normalized,
          },
        },
        create: {
          organizationId: user.organizationId!,
          normalizedName: normalized,
          originalName: app.name,
          confidence: 1.0, // confirmed by a user, so 100%
          reasoning: "Confirmed as non-SaaS by a user",
          transactionCount: 1,
        },
        update: {
          transactionCount: { increment: 1 },
          lastSeenAt: new Date(),
        },
      });
    });

    await sendConfirmationEmail({
      organizationId: user.organizationId!,
      appName: app.name,
      action: "rejected",
      confidence: null,
      normalizedName,
      actorEmail: user.email ?? null,
    });

    revalidatePath("/");
    revalidatePath("/settings/saas-review");

    return {
      success: true,
      message: `"${app.name}" has been marked as non-SaaS`,
    };
  } catch (error) {
    logger.error({ err: error }, "Non-SaaS processing failed");
    return {
      success: false,
      message: "An error occurred while marking as non-SaaS",
    };
  }
}
export const confirmAsNonSaaS = withLogging(
  "confirmAsNonSaaS",
  _confirmAsNonSaaS
);

async function sendConfirmationEmail(params: {
  organizationId: string;
  appName: string;
  action: "approved" | "rejected";
  confidence: number | null;
  normalizedName: string | null;
  actorEmail: string | null;
}) {
  try {
    const [org, adminFallback] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: params.organizationId },
        select: { name: true },
      }),
      prisma.user.findFirst({
        where: {
          organizationId: params.organizationId,
          role: "ADMIN",
          status: "ACTIVE",
        },
        select: { email: true },
      }),
    ]);

    const recipient = params.actorEmail || adminFallback?.email;
    if (!recipient) return;

    await sendConfirmationResultEmail({
      to: recipient,
      organizationName: org?.name || "SubHub",
      appName: params.appName,
      action: params.action,
      confidence: params.confidence,
      normalizedName: params.normalizedName || undefined,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to send confirmation result email");
  }
}

/**
 * For the dashboard summary: count items needing confirmation
 */
export async function getPendingConfirmationsCount(): Promise<number> {
  const sessionResult = await requireSession();
  if ("error" in sessionResult) {
    return 0;
  }

  const { user } = sessionResult;

  try {
    const count = await prisma.vendorInferenceLog.count({
      where: {
        organizationId: user.organizationId!,
        confidence: { gte: CONFIDENCE_MIN, lte: CONFIDENCE_MAX },
        isSaaS: true,
        app: { status: AppStatus.PENDING_REVIEW },
      },
    });

    return count;
  } catch {
    return 0;
  }
}
