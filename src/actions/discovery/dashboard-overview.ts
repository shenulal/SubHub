// src/actions/discovery/dashboard-overview.ts
"use server";

/**
 * Dashboard overview (4.1 / 4.2 / 4.4): KPI row, upcoming renewals and the
 * category breakdown, all converted to the organisation base currency and
 * filtered by workspace scope.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { isForbiddenError, requirePermission } from "@/lib/rbac/service";
import { createBaseConverter } from "@/lib/services/discovery/base-currency";
import { getCategorySpendBreakdown } from "@/lib/services/discovery/category-spend";
import { daysBetweenUtc } from "@/lib/services/discovery/pipeline-buckets";
import { discoveryWhere } from "@/lib/services/discovery/scope-where";
import { getSettings } from "@/lib/settings/service";
import {
  categorySpendQuerySchema,
  workspaceScopeSchema,
} from "@/lib/validations/discovery";
import type { ActionState } from "@/types";
import type {
  CategorySpendSlice,
  DashboardOverview,
  DashboardRenewalRow,
} from "@/types/discovery";

import { getWorkspaceScope } from "./scope";

const MONTHS_PER_YEAR = 12;

async function viewerContext(userId: string, permissions: Set<string>) {
  const viewer = await prisma.user.findUnique({
    where: { id: userId },
    select: { teamId: true },
  });
  return {
    userId,
    teamId: viewer?.teamId ?? null,
    canReadAll: permissions.has("subscriptions:read_all"),
  };
}

/**
 * KPI row + upcoming renewals + category breakdown for the dashboard.
 */
export const getDashboardOverview = withLogging(
  "getDashboardOverview",
  async (scopeInput?: unknown): Promise<ActionState<DashboardOverview>> => {
    try {
      const { organizationId, userId, permissions } =
        await requirePermission("reports:read");
      const [settings, scopeState, viewer, converter] = await Promise.all([
        getSettings(organizationId, [
          "discovery.renewingSoonDays",
          "discovery.topSpendCount",
        ]),
        getWorkspaceScope(),
        viewerContext(userId, permissions),
        createBaseConverter(organizationId),
      ]);
      const explicit = workspaceScopeSchema.safeParse(scopeInput);
      const scope = explicit.success ? explicit.data : scopeState.scope;
      const renewingSoonDays = settings["discovery.renewingSoonDays"];
      const now = new Date();
      const soon = new Date(now.getTime() + renewingSoonDays * 86_400_000);

      const [active, pendingApprovals] = await Promise.all([
        prisma.subscription.findMany({
          where: discoveryWhere(organizationId, scope, viewer, {
            status: "ACTIVE",
          }),
          select: {
            id: true,
            amount: true,
            currency: true,
            billingCycle: true,
            renewalDate: true,
            isTrial: true,
            app: {
              select: {
                name: true,
                customLogoUrl: true,
                catalog: { select: { logoUrl: true } },
              },
            },
          },
        }),
        scope !== "personal" && permissions.has("approvals:read")
          ? prisma.approvalRequest.findMany({
              where: {
                organizationId,
                status: "PENDING",
                ...(permissions.has("approvals:read_all")
                  ? {}
                  : { requesterId: userId }),
              },
              select: { monthlyAmount: true, currency: true },
            })
          : Promise.resolve([]),
      ]);

      let monthlySpendBase = 0;
      const renewalRows: DashboardRenewalRow[] = [];
      for (const sub of active) {
        const monthly = await converter.monthlyBase(
          Number(sub.amount),
          sub.currency,
          sub.billingCycle
        );
        monthlySpendBase += monthly;
        if (
          sub.renewalDate &&
          sub.renewalDate >= now &&
          sub.renewalDate <= soon
        ) {
          renewalRows.push({
            id: sub.id,
            appName: sub.app.name,
            appLogoUrl:
              sub.app.customLogoUrl ?? sub.app.catalog?.logoUrl ?? null,
            renewalDate: sub.renewalDate.toISOString(),
            daysUntilRenewal: daysBetweenUtc(now, sub.renewalDate),
            amountBase: await converter.toBase(
              Number(sub.amount),
              sub.currency
            ),
            isTrial: sub.isTrial,
          });
        }
      }

      let pendingApprovalsMonthlyBase = 0;
      for (const req of pendingApprovals) {
        pendingApprovalsMonthlyBase += await converter.toBase(
          Number(req.monthlyAmount),
          req.currency
        );
      }

      const categorySpend = await getCategorySpendBreakdown({
        organizationId,
        scope,
        viewer,
        converter,
      });

      const upcomingRenewals = [...renewalRows]
        .sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal)
        .slice(0, settings["discovery.topSpendCount"]);

      return {
        success: true,
        data: {
          scope,
          baseCurrency: converter.baseCurrency,
          hasStaleRates: converter.hasStaleRates,
          generatedAt: now.toISOString(),
          kpis: {
            monthlySpendBase,
            annualRunRateBase: monthlySpendBase * MONTHS_PER_YEAR,
            activeCount: active.length,
            renewingSoonCount: renewalRows.length,
            renewingSoonDays,
            pendingApprovalsCount: pendingApprovals.length,
            pendingApprovalsMonthlyBase,
          },
          upcomingRenewals,
          categorySpend,
        },
      };
    } catch (error) {
      if (isForbiddenError(error)) {
        return { success: false, error: error.message };
      }
      logger.error({ err: error }, "[discovery] getDashboardOverview failed");
      return { success: false, error: "Could not load dashboard" };
    }
  }
);

/**
 * Category breakdown with optional owner/team filter (used by the chart filter).
 */
export const getCategorySpendForDashboard = withLogging(
  "getCategorySpendForDashboard",
  async (input: unknown = {}): Promise<ActionState<CategorySpendSlice[]>> => {
    const parsed = categorySpendQuerySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid filter" };
    try {
      const { organizationId, userId, permissions } =
        await requirePermission("reports:read");
      const [scopeState, viewer, converter] = await Promise.all([
        getWorkspaceScope(),
        viewerContext(userId, permissions),
        createBaseConverter(organizationId),
      ]);
      const data = await getCategorySpendBreakdown({
        organizationId,
        scope: parsed.data.scope ?? scopeState.scope,
        viewer,
        ownerId: parsed.data.ownerId,
        teamId: parsed.data.teamId,
        converter,
      });
      return { success: true, data };
    } catch (error) {
      if (isForbiddenError(error)) {
        return { success: false, error: error.message };
      }
      logger.error({ err: error }, "[discovery] category spend failed");
      return { success: false, error: "Could not load category spend" };
    }
  }
);
