// src/actions/discovery/calendar-extras.ts
"use server";

/**
 * Calendar extras (9.4): wraps the Lifecycle agent's `getRenewalCalendar` and
 * adds trial endings and cancellation deadlines as distinct markers.
 */
import {
  getRenewalCalendar,
  type CalendarData,
} from "@/actions/subscriptions/subscription-calendar";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { isForbiddenError, requirePermission } from "@/lib/rbac/service";
import { discoveryWhere } from "@/lib/services/discovery/scope-where";
import { workspaceScopeSchema } from "@/lib/validations/discovery";
import type { ActionState } from "@/types";
import type {
  CalendarMarker,
  CalendarMarkerKind,
  WorkspaceScope,
} from "@/types/discovery";
import type { Prisma } from "@prisma/client";

import { getWorkspaceScope } from "./scope";

export interface CalendarWithMarkers extends CalendarData {
  scope: WorkspaceScope;
  markers: Record<string, CalendarMarker[]>;
}

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

function dateKeyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const markerSelect = {
  id: true,
  amount: true,
  currency: true,
  trialEndsAt: true,
  cancellationDeadline: true,
  app: {
    select: {
      name: true,
      customLogoUrl: true,
      catalog: { select: { logoUrl: true } },
    },
  },
} satisfies Prisma.SubscriptionSelect;

type MarkerRow = Prisma.SubscriptionGetPayload<{ select: typeof markerSelect }>;

function toMarker(
  row: MarkerRow,
  kind: CalendarMarkerKind,
  date: Date
): CalendarMarker {
  return {
    kind,
    subscriptionId: row.id,
    appName: row.app.name,
    appLogoUrl: row.app.customLogoUrl ?? row.app.catalog?.logoUrl ?? null,
    date: dateKeyUtc(date),
    amount: Number(row.amount),
    currency: row.currency,
  };
}

function groupByDate(
  markers: CalendarMarker[]
): Record<string, CalendarMarker[]> {
  return markers.reduce<Record<string, CalendarMarker[]>>((acc, m) => {
    return { ...acc, [m.date]: [...(acc[m.date] ?? []), m] };
  }, {});
}

/**
 * Month view with renewals (from the lifecycle calendar) plus trial/notice markers.
 */
export const getRenewalCalendarWithMarkers = withLogging(
  "getRenewalCalendarWithMarkers",
  async (
    year: number,
    month: number,
    scopeInput?: unknown
  ): Promise<ActionState<CalendarWithMarkers>> => {
    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      year < MIN_YEAR ||
      year > MAX_YEAR ||
      month < 1 ||
      month > 12
    ) {
      return { success: false, error: "Invalid month" };
    }
    try {
      const { organizationId, userId, permissions } =
        await requirePermission("subscriptions:read");
      const [scopeState, viewer, base] = await Promise.all([
        getWorkspaceScope(),
        prisma.user.findUnique({
          where: { id: userId },
          select: { teamId: true },
        }),
        getRenewalCalendar(year, month),
      ]);
      const explicit = workspaceScopeSchema.safeParse(scopeInput);
      const scope = explicit.success ? explicit.data : scopeState.scope;
      const viewerCtx = {
        userId,
        teamId: viewer?.teamId ?? null,
        canReadAll: permissions.has("subscriptions:read_all"),
      };
      const monthStart = new Date(Date.UTC(year, month - 1, 1));
      const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      const range = { gte: monthStart, lte: monthEnd };

      const [trials, notices] = await Promise.all([
        prisma.subscription.findMany({
          where: discoveryWhere(organizationId, scope, viewerCtx, {
            isTrial: true,
            trialEndsAt: range,
            status: { notIn: ["ARCHIVED", "CANCELLED"] },
          }),
          select: markerSelect,
        }),
        prisma.subscription.findMany({
          where: discoveryWhere(organizationId, scope, viewerCtx, {
            cancellationDeadline: range,
            status: { notIn: ["ARCHIVED", "CANCELLED"] },
          }),
          select: markerSelect,
        }),
      ]);

      const markers = [
        ...trials
          .filter((r) => r.trialEndsAt)
          .map((r) => toMarker(r, "trialEnd", r.trialEndsAt as Date)),
        ...notices
          .filter((r) => r.cancellationDeadline)
          .map((r) =>
            toMarker(r, "cancellationDeadline", r.cancellationDeadline as Date)
          ),
      ];

      return {
        success: true,
        data: { ...base, scope, markers: groupByDate(markers) },
      };
    } catch (error) {
      if (isForbiddenError(error)) {
        return { success: false, error: error.message };
      }
      logger.error({ err: error }, "[discovery] calendar extras failed");
      return { success: false, error: "Could not load calendar" };
    }
  }
);
