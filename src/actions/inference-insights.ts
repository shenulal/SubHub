// src/actions/inference-insights.ts
"use server";

import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { Prisma } from "@prisma/client";
import { Resend } from "resend";

// Lazy initialization to avoid build-time errors
let resendClient: Resend | null = null;
function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY || "dummy-key-for-build";
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export interface InferenceMetrics {
  totalCalls: number;
  successfulCalls: number;
  successRate: number;
  averageTokens: {
    prompt: number | null;
    completion: number | null;
    total: number | null;
  };
  errorCounts: Record<string, number>;
  recentFailures: Array<{
    merchantName: string;
    errorCode: string | null;
    createdAt: Date;
    reasoning: string | null;
    confidence: number;
  }>;
}

/**
 * Get LLM call metrics from VendorInferenceLog
 * - Success: entries with a rawResult
 * - Failure: entries with an errorCode or no rawResult
 */
export async function getInferenceMetrics(): Promise<InferenceMetrics> {
  const { organizationId } = await requireOrganization();

  const [totalCalls, successfulCalls, tokenAgg, errorBuckets, recentFailures] =
    await Promise.all([
      prisma.vendorInferenceLog.count({ where: { organizationId } }),
      prisma.vendorInferenceLog.count({
        where: {
          organizationId,
          NOT: { rawResult: { equals: Prisma.DbNull } },
        },
      }),
      prisma.vendorInferenceLog.aggregate({
        where: { organizationId },
        _avg: {
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
        },
      }),
      prisma.vendorInferenceLog.groupBy({
        by: ["errorCode"],
        where: { organizationId, errorCode: { not: null } },
        _count: { _all: true },
      }),
      prisma.vendorInferenceLog.findMany({
        where: {
          organizationId,
          OR: [
            { errorCode: { not: null } },
            { rawResult: { equals: Prisma.DbNull } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          merchantName: true,
          errorCode: true,
          createdAt: true,
          reasoning: true,
          confidence: true,
        },
      }),
    ]);

  const errorCounts = errorBuckets.reduce<Record<string, number>>(
    (acc, bucket) => {
      const key = bucket.errorCode || "unknown";
      acc[key] = (acc[key] || 0) + bucket._count._all;
      return acc;
    },
    {}
  );

  const successRate =
    totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 1000) / 10 : 0;

  return {
    totalCalls,
    successfulCalls,
    successRate,
    averageTokens: {
      prompt: tokenAgg._avg.promptTokens
        ? Number(tokenAgg._avg.promptTokens)
        : null,
      completion: tokenAgg._avg.completionTokens
        ? Number(tokenAgg._avg.completionTokens)
        : null,
      total: tokenAgg._avg.totalTokens
        ? Number(tokenAgg._avg.totalTokens)
        : null,
    },
    errorCounts,
    recentFailures: recentFailures.map((item) => ({
      merchantName: item.merchantName,
      errorCode: item.errorCode,
      createdAt: item.createdAt,
      reasoning: item.reasoning,
      confidence: item.confidence,
    })),
  };
}

interface SendInferenceMetricsEmailResult {
  success: boolean;
  message: string;
}

async function _sendInferenceMetricsEmail(): Promise<SendInferenceMetricsEmailResult> {
  const { organizationId, role, session } = await requireOrganization();

  if (role !== "ADMIN") {
    return {
      success: false,
      message: "Only admins can send email alerts.",
    };
  }

  const [organization, metrics] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        name: true,
        users: {
          where: { role: "ADMIN" },
          select: { email: true, name: true },
        },
      },
    }),
    getInferenceMetrics(),
  ]);

  const recipients =
    organization?.users
      .map((u) => u.email)
      .filter((e): e is string => Boolean(e)) ?? [];
  if (recipients.length === 0 && session.user.email) {
    recipients.push(session.user.email);
  }
  if (recipients.length === 0) {
    return {
      success: false,
      message: "No admin email address found to send to.",
    };
  }

  const errorEntries = Object.entries(metrics.errorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const resend = getResend();
  const today = new Date().toLocaleDateString("ko-KR");
  const orgName = organization?.name || "SubHub";
  const subject = `[${orgName}] LLM matching metrics alert - ${today}`;

  const html = `
    <div style="font-family: Lato, Inter, sans-serif; max-width: 640px;">
      <h2>LLM matching metrics alert</h2>
      <p>Recent LLM matching metrics for ${orgName}.</p>
      <ul>
        <li>Total calls: ${metrics.totalCalls}</li>
        <li>Successful (with result): ${metrics.successfulCalls} (${metrics.successRate.toFixed(1)}%)</li>
        <li>Average tokens: prompt ${metrics.averageTokens.prompt ?? "-"} / completion ${
          metrics.averageTokens.completion ?? "-"
        } / total ${metrics.averageTokens.total ?? "-"}</li>
      </ul>
      <h4>Top 5 recent errors</h4>
      <ul>
        ${
          errorEntries.length === 0
            ? "<li>No errors</li>"
            : errorEntries
                .map(([code, count]) => `<li>${code}: ${count}</li>`)
                .join("")
        }
      </ul>
      <p style="color:#666;font-size:12px;">This is an automated alert email for administrators.</p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: "SubHub <reports@resend.dev>",
      to: recipients,
      subject,
      html,
    });
    return { success: true, message: "Email sent." };
  } catch (error) {
    logger.error({ err: error }, "[Inference Email] Send failed");
    return { success: false, message: "Failed to send the email." };
  }
}
export const sendInferenceMetricsEmail = withLogging(
  "sendInferenceMetricsEmail",
  _sendInferenceMetricsEmail
);
