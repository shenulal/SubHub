// src/actions/discovery/list.ts
"use server";

/**
 * Subscription list page data (9.2 / 9.3): filtered, sorted, paginated rows
 * with category, tags and owner, plus the filtered total count and monthly
 * total in the organisation base currency. Also serves filter reference data.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { isForbiddenError, requirePermission } from "@/lib/rbac/service";
import { createBaseConverter } from "@/lib/services/discovery/base-currency";
import { listRowSelect, toListItem } from "@/lib/services/discovery/list-rows";
import {
  filterToWhere,
  sortToOrderBy,
} from "@/lib/services/discovery/list-where";
import { discoveryWhere } from "@/lib/services/discovery/scope-where";
import { getSettings } from "@/lib/settings/service";
import {
  subscriptionFilterSchema,
  subscriptionSortSchema,
} from "@/lib/validations/discovery";
import type { ActionState, PaginatedResponse } from "@/types";
import type {
  CategoryOption,
  DiscoverySubscriptionItem,
  SubscriptionFilterOptions,
  SubscriptionListQuery,
} from "@/types/discovery";
import { z } from "zod";

import { getWorkspaceScope } from "./scope";

export interface SubscriptionListPage extends PaginatedResponse<DiscoverySubscriptionItem> {
  monthlyTotalBase: number;
  baseCurrency: string;
  hasStaleRates: boolean;
  pageSizeOptions: number[];
}

const listQuerySchema = z.object({
  filter: subscriptionFilterSchema,
  sort: subscriptionSortSchema,
  page: z.number().int().min(1),
  limit: z.number().int().min(1).max(500),
});

/**
 * One page of the subscription list for the given URL-derived query.
 */
export const getSubscriptionListPage = withLogging(
  "getSubscriptionListPage",
  async (
    queryInput: SubscriptionListQuery
  ): Promise<ActionState<SubscriptionListPage>> => {
    const parsed = listQuerySchema.safeParse(queryInput);
    if (!parsed.success) return { success: false, error: "Invalid query" };
    const { filter, sort, page, limit } = parsed.data;
    try {
      const { organizationId, userId, permissions } =
        await requirePermission("subscriptions:read");
      const [scopeState, viewer, converter, settings] = await Promise.all([
        getWorkspaceScope(),
        prisma.user.findUnique({
          where: { id: userId },
          select: { teamId: true },
        }),
        createBaseConverter(organizationId),
        getSettings(organizationId, [
          "discovery.listPageSizeOptions",
          "discovery.exportMaxRows",
        ]),
      ]);
      const scope = filter.scope ?? scopeState.scope;
      const where = discoveryWhere(
        organizationId,
        scope,
        {
          userId,
          teamId: viewer?.teamId ?? null,
          canReadAll: permissions.has("subscriptions:read_all"),
        },
        filterToWhere(filter)
      );

      const [rows, total, totals] = await Promise.all([
        prisma.subscription.findMany({
          where,
          select: listRowSelect,
          orderBy: sortToOrderBy(sort),
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.subscription.count({ where }),
        prisma.subscription.findMany({
          where,
          select: { amount: true, currency: true, billingCycle: true },
        }),
      ]);

      let monthlyTotalBase = 0;
      for (const t of totals) {
        monthlyTotalBase += await converter.monthlyBase(
          Number(t.amount),
          t.currency,
          t.billingCycle
        );
      }
      const items = await Promise.all(
        rows.map(async (row) =>
          toListItem(
            row,
            await converter.monthlyBase(
              Number(row.amount),
              row.currency,
              row.billingCycle
            )
          )
        )
      );

      return {
        success: true,
        data: {
          items,
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          monthlyTotalBase,
          baseCurrency: converter.baseCurrency,
          hasStaleRates: converter.hasStaleRates,
          pageSizeOptions: settings["discovery.listPageSizeOptions"],
        },
      };
    } catch (error) {
      if (isForbiddenError(error)) {
        return { success: false, error: error.message };
      }
      logger.error(
        { err: error },
        "[discovery] getSubscriptionListPage failed"
      );
      return { success: false, error: "Could not load subscriptions" };
    }
  }
);

function buildCategoryTree(
  rows: Array<{
    id: string;
    name: string;
    color: string | null;
    parentId: string | null;
  }>
): CategoryOption[] {
  const children = rows.filter((r) => r.parentId);
  return rows
    .filter((r) => !r.parentId)
    .map((parent) => ({
      ...parent,
      children: children
        .filter((c) => c.parentId === parent.id)
        .map((c) => ({ ...c })),
    }));
}

/**
 * Reference data for the filter bar and bulk bar.
 */
export const getSubscriptionFilterOptions = withLogging(
  "getSubscriptionFilterOptions",
  async (): Promise<ActionState<SubscriptionFilterOptions>> => {
    try {
      const { organizationId } = await requirePermission("subscriptions:read");
      const [categories, tags, owners, teams, costCenters, paymentMethods] =
        await Promise.all([
          prisma.category.findMany({
            where: { organizationId, isArchived: false },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: { id: true, name: true, color: true, parentId: true },
          }),
          prisma.tag.findMany({
            where: { organizationId },
            orderBy: { name: "asc" },
            select: { id: true, name: true, color: true },
          }),
          prisma.user.findMany({
            where: { organizationId, status: "ACTIVE" },
            orderBy: { name: "asc" },
            select: { id: true, name: true, email: true },
          }),
          prisma.team.findMany({
            where: { organizationId },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          }),
          prisma.costCenter.findMany({
            where: { organizationId, isActive: true },
            orderBy: { code: "asc" },
            select: { id: true, name: true, code: true },
          }),
          prisma.paymentMethodOption.findMany({
            where: { organizationId, isActive: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: { id: true, name: true },
          }),
        ]);
      return {
        success: true,
        data: {
          categories: buildCategoryTree(categories),
          tags,
          owners: owners.map((o) => ({ id: o.id, name: o.name ?? o.email })),
          teams,
          costCenters: costCenters.map((c) => ({
            id: c.id,
            name: `${c.code} · ${c.name}`,
          })),
          paymentMethods,
        },
      };
    } catch (error) {
      if (isForbiddenError(error)) {
        return { success: false, error: error.message };
      }
      logger.error({ err: error }, "[discovery] filter options failed");
      return { success: false, error: "Could not load filter options" };
    }
  }
);

/**
 * Ids of every subscription matching a filter ("select all matching" in the
 * bulk bar). Capped by `discovery.exportMaxRows` to keep bulk jobs bounded.
 */
export const getMatchingSubscriptionIds = withLogging(
  "getMatchingSubscriptionIds",
  async (
    filterInput: unknown
  ): Promise<ActionState<{ ids: string[]; capped: boolean }>> => {
    const parsed = subscriptionFilterSchema.safeParse(filterInput ?? {});
    if (!parsed.success) return { success: false, error: "Invalid filter" };
    try {
      const { organizationId, userId, permissions } =
        await requirePermission("subscriptions:read");
      const [scopeState, viewer, settings] = await Promise.all([
        getWorkspaceScope(),
        prisma.user.findUnique({
          where: { id: userId },
          select: { teamId: true },
        }),
        getSettings(organizationId, ["discovery.exportMaxRows"]),
      ]);
      const cap = settings["discovery.exportMaxRows"];
      const rows = await prisma.subscription.findMany({
        where: discoveryWhere(
          organizationId,
          parsed.data.scope ?? scopeState.scope,
          {
            userId,
            teamId: viewer?.teamId ?? null,
            canReadAll: permissions.has("subscriptions:read_all"),
          },
          filterToWhere(parsed.data)
        ),
        select: { id: true },
        take: cap + 1,
      });
      const capped = rows.length > cap;
      return {
        success: true,
        data: { ids: rows.slice(0, cap).map((r) => r.id), capped },
      };
    } catch (error) {
      if (isForbiddenError(error)) {
        return { success: false, error: error.message };
      }
      logger.error({ err: error }, "[discovery] matching ids failed");
      return { success: false, error: "Could not resolve selection" };
    }
  }
);
