// src/actions/discovery/pipeline.ts
"use server";

/**
 * Renewal pipeline (9.5): ACTIVE subscriptions grouped by renewal date into
 * Overdue / This week / This month / Later, plus trial endings and notice
 * deadlines as separate lanes. All totals are in the organisation base currency.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { isForbiddenError, requirePermission } from "@/lib/rbac/service";
import {
  createBaseConverter,
  loadCycleMonths,
  type BaseConverter,
} from "@/lib/services/discovery/base-currency";
import {
  toAnnualAmount,
  type CycleMonths,
} from "@/lib/services/discovery/money";
import {
  bucketPipeline,
  daysBetweenUtc,
} from "@/lib/services/discovery/pipeline-buckets";
import { discoveryWhere } from "@/lib/services/discovery/scope-where";
import { getSettings } from "@/lib/settings/service";
import { pipelineQuerySchema } from "@/lib/validations/discovery";
import type { ActionState } from "@/types";
import type { PipelineCard, RenewalPipelineData } from "@/types/discovery";
import type { Prisma } from "@prisma/client";

import { getWorkspaceScope } from "./scope";

const cardSelect = {
  id: true,
  appId: true,
  status: true,
  billingCycle: true,
  amount: true,
  currency: true,
  renewalDate: true,
  trialEndsAt: true,
  cancellationDeadline: true,
  isTrial: true,
  isPersonal: true,
  app: {
    select: {
      name: true,
      customLogoUrl: true,
      catalog: { select: { logoUrl: true } },
    },
  },
  owner: { select: { id: true, name: true } },
  team: { select: { name: true } },
} satisfies Prisma.SubscriptionSelect;

type Row = Prisma.SubscriptionGetPayload<{ select: typeof cardSelect }>;

async function toCard(
  row: Row,
  dueDate: Date,
  now: Date,
  converter: BaseConverter,
  cycleMonths: CycleMonths
): Promise<PipelineCard> {
  const amount = Number(row.amount);
  const base = await converter.toBase(amount, row.currency);
  return {
    id: row.id,
    appId: row.appId,
    appName: row.app.name,
    appLogoUrl: row.app.customLogoUrl ?? row.app.catalog?.logoUrl ?? null,
    amount,
    currency: row.currency,
    monthlyBase: await converter.monthlyBase(
      amount,
      row.currency,
      row.billingCycle
    ),
    annualBase: toAnnualAmount(base, row.billingCycle, cycleMonths),
    billingCycle: row.billingCycle,
    status: row.status,
    dueDate: dueDate.toISOString(),
    daysLeft: daysBetweenUtc(now, dueDate),
    owner: row.owner ? { id: row.owner.id, name: row.owner.name } : null,
    teamName: row.team?.name ?? null,
    isTrial: row.isTrial,
    isPersonal: row.isPersonal,
  };
}

/**
 * Build the pipeline for the active scope (or an explicit one).
 */
export const getRenewalPipeline = withLogging(
  "getRenewalPipeline",
  async (input: unknown = {}): Promise<ActionState<RenewalPipelineData>> => {
    const parsed = pipelineQuerySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };
    try {
      const { organizationId, userId, permissions } =
        await requirePermission("subscriptions:read");
      const [settings, scopeState, viewer, converter, cycleMonths] =
        await Promise.all([
          getSettings(organizationId, [
            "discovery.pipelineWeekDays",
            "discovery.pipelineMonthDays",
            "discovery.pipelineOverdueGraceDays",
          ]),
          getWorkspaceScope(),
          prisma.user.findUnique({
            where: { id: userId },
            select: { teamId: true },
          }),
          createBaseConverter(organizationId),
          loadCycleMonths(organizationId),
        ]);
      const scope = parsed.data.scope ?? scopeState.scope;
      const viewerCtx = {
        userId,
        teamId: viewer?.teamId ?? null,
        canReadAll: permissions.has("subscriptions:read_all"),
      };
      const now = new Date();
      const startOfToday = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      );

      const [renewalRows, trialRows, noticeRows] = await Promise.all([
        prisma.subscription.findMany({
          where: discoveryWhere(organizationId, scope, viewerCtx, {
            status: "ACTIVE",
            renewalDate: { not: null },
          }),
          select: cardSelect,
          orderBy: { renewalDate: "asc" },
        }),
        prisma.subscription.findMany({
          where: discoveryWhere(organizationId, scope, viewerCtx, {
            status: { in: ["ACTIVE", "PENDING"] },
            isTrial: true,
            trialEndsAt: { gte: startOfToday },
          }),
          select: cardSelect,
          orderBy: { trialEndsAt: "asc" },
        }),
        prisma.subscription.findMany({
          where: discoveryWhere(organizationId, scope, viewerCtx, {
            status: "ACTIVE",
            cancellationDeadline: { gte: startOfToday },
          }),
          select: cardSelect,
          orderBy: { cancellationDeadline: "asc" },
        }),
      ]);

      const build = (rows: Row[], pick: (r: Row) => Date | null) =>
        Promise.all(
          rows
            .map((r) => ({ r, due: pick(r) }))
            .filter((x): x is { r: Row; due: Date } => x.due !== null)
            .map((x) => toCard(x.r, x.due, now, converter, cycleMonths))
        );

      const [renewals, trialEndings, noticeDeadlines] = await Promise.all([
        build(renewalRows, (r) => r.renewalDate),
        build(trialRows, (r) => r.trialEndsAt),
        build(noticeRows, (r) => r.cancellationDeadline),
      ]);

      const weekDays = settings["discovery.pipelineWeekDays"];
      const monthDays = settings["discovery.pipelineMonthDays"];
      const lanes = bucketPipeline(
        { renewals, trialEndings, noticeDeadlines },
        {
          now,
          weekDays,
          monthDays,
          overdueGraceDays: settings["discovery.pipelineOverdueGraceDays"],
        }
      );
      return {
        success: true,
        data: {
          baseCurrency: converter.baseCurrency,
          generatedAt: now.toISOString(),
          weekDays,
          monthDays,
          hasStaleRates: converter.hasStaleRates,
          lanes,
        },
      };
    } catch (error) {
      if (isForbiddenError(error)) {
        return { success: false, error: error.message };
      }
      logger.error({ err: error }, "[discovery] getRenewalPipeline failed");
      return { success: false, error: "Could not load renewal pipeline" };
    }
  }
);
