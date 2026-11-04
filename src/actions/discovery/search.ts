// src/actions/discovery/search.ts
"use server";

/**
 * Global search (9.1). Results are grouped and permission-aware: each group is
 * only queried when the viewer holds the matching permission, and subscription
 * rows respect workspace scope and row-level visibility.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { isForbiddenError, requirePermission } from "@/lib/rbac/service";
import { discoveryWhere } from "@/lib/services/discovery/scope-where";
import { searchCatalog } from "@/lib/services/discovery/search-catalog";
import { getSettings } from "@/lib/settings/service";
import { globalSearchInputSchema } from "@/lib/validations/discovery";
import type { ActionState } from "@/types";
import type {
  GlobalSearchResult,
  SearchResultGroup,
  SearchResultItem,
  WorkspaceScope,
} from "@/types/discovery";
import type { Prisma } from "@prisma/client";

import { getWorkspaceScope } from "./scope";

interface SearchContext {
  organizationId: string;
  userId: string;
  teamId: string | null;
  permissions: Set<string>;
  scope: WorkspaceScope;
  limit: number;
}

const insensitive = (value: string): Prisma.StringFilter => ({
  contains: value,
  mode: "insensitive",
});

async function searchSubscriptions(
  q: string,
  ctx: SearchContext
): Promise<SearchResultItem[]> {
  if (!ctx.permissions.has("subscriptions:read")) return [];
  const rows = await prisma.subscription.findMany({
    where: discoveryWhere(
      ctx.organizationId,
      ctx.scope,
      {
        userId: ctx.userId,
        teamId: ctx.teamId,
        canReadAll: ctx.permissions.has("subscriptions:read_all"),
      },
      {
        OR: [
          { app: { name: insensitive(q) } },
          { app: { catalog: { vendorName: insensitive(q) } } },
          { notes: insensitive(q) },
          { category: { name: insensitive(q) } },
          { tags: { some: { tag: { name: insensitive(q) } } } },
          { customFieldValues: { some: { value: insensitive(q) } } },
        ],
      }
    ),
    take: ctx.limit,
    orderBy: { app: { name: "asc" } },
    select: {
      id: true,
      status: true,
      amount: true,
      currency: true,
      app: {
        select: {
          name: true,
          customLogoUrl: true,
          catalog: { select: { logoUrl: true, vendorName: true } },
        },
      },
      category: { select: { name: true } },
    },
  });
  return rows.map((s) => ({
    id: s.id,
    group: "subscriptions",
    title: s.app.name,
    subtitle: [s.category?.name, s.app.catalog?.vendorName, s.status]
      .filter(Boolean)
      .join(" · "),
    href: `/subscriptions/${s.id}`,
    imageUrl: s.app.customLogoUrl ?? s.app.catalog?.logoUrl ?? null,
  }));
}

async function searchVendors(
  q: string,
  ctx: SearchContext
): Promise<SearchResultItem[]> {
  if (!ctx.permissions.has("subscriptions:read")) return [];
  const rows = await prisma.saaSCatalog.findMany({
    where: {
      isActive: true,
      OR: [
        { name: insensitive(q) },
        { vendorName: insensitive(q) },
        { aliases: { has: q } },
      ],
    },
    take: ctx.limit,
    orderBy: { name: "asc" },
    select: { id: true, name: true, category: true, logoUrl: true, slug: true },
  });
  return rows.map((v) => ({
    id: v.id,
    group: "vendors",
    title: v.name,
    subtitle: v.category,
    href: `/subscriptions/new?catalog=${encodeURIComponent(v.slug)}`,
    imageUrl: v.logoUrl,
  }));
}

async function searchApprovals(
  q: string,
  ctx: SearchContext
): Promise<SearchResultItem[]> {
  if (!ctx.permissions.has("approvals:read")) return [];
  const where: Prisma.ApprovalRequestWhereInput = {
    organizationId: ctx.organizationId,
    serviceName: insensitive(q),
    ...(ctx.permissions.has("approvals:read_all")
      ? {}
      : { requesterId: ctx.userId }),
  };
  const rows = await prisma.approvalRequest.findMany({
    where,
    take: ctx.limit,
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      serviceName: true,
      status: true,
      requester: { select: { name: true, email: true } },
    },
  });
  return rows.map((a) => ({
    id: a.id,
    group: "approvals",
    title: a.serviceName,
    subtitle: `${a.status} · ${a.requester.name ?? a.requester.email}`,
    href: `/approvals/${a.id}`,
  }));
}

async function searchPeople(
  q: string,
  ctx: SearchContext
): Promise<SearchResultItem[]> {
  if (!ctx.permissions.has("members:read")) return [];
  const rows = await prisma.user.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: { not: "TERMINATED" },
      OR: [{ name: insensitive(q) }, { email: insensitive(q) }],
    },
    take: ctx.limit,
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
  return rows.map((u) => ({
    id: u.id,
    group: "people",
    title: u.name ?? u.email,
    subtitle: u.name ? u.email : undefined,
    href: `/users/${u.id}`,
    imageUrl: u.avatarUrl,
  }));
}

async function runGroup(
  key: SearchResultGroup["key"],
  loader: () => Promise<SearchResultItem[]>
): Promise<SearchResultGroup> {
  try {
    return { key, items: await loader() };
  } catch (error) {
    logger.warn({ err: error, group: key }, "[discovery] search group failed");
    return { key, items: [] };
  }
}

/**
 * Grouped, permission-aware search across the workspace.
 */
export const globalSearch = withLogging(
  "globalSearch",
  async (
    query: string,
    options: { limit?: number } = {}
  ): Promise<ActionState<GlobalSearchResult>> => {
    const parsed = globalSearchInputSchema.safeParse({ query, ...options });
    if (!parsed.success) return { success: false, error: "Invalid query" };
    try {
      const { organizationId, userId, permissions } =
        await requirePermission("subscriptions:read");
      const [settings, scopeState, viewer] = await Promise.all([
        getSettings(organizationId, [
          "discovery.searchResultLimit",
          "discovery.searchMinChars",
          "discovery.recentSearchesLimit",
        ]),
        getWorkspaceScope(),
        prisma.user.findUnique({
          where: { id: userId },
          select: { teamId: true },
        }),
      ]);
      const limit = Math.min(
        parsed.data.limit ?? settings["discovery.searchResultLimit"],
        settings["discovery.searchResultLimit"]
      );
      const meta = {
        limit,
        minChars: settings["discovery.searchMinChars"],
        recentSearchesLimit: settings["discovery.recentSearchesLimit"],
      };
      const q = parsed.data.query;
      const ctx: SearchContext = {
        organizationId,
        userId,
        teamId: viewer?.teamId ?? null,
        permissions,
        scope: scopeState.scope,
        limit,
      };
      const tooShort = q.length < meta.minChars;
      const groups: SearchResultGroup[] = tooShort
        ? []
        : await Promise.all([
            runGroup("subscriptions", () => searchSubscriptions(q, ctx)),
            runGroup("approvals", () => searchApprovals(q, ctx)),
            runGroup("vendors", () => searchVendors(q, ctx)),
            runGroup("people", () => searchPeople(q, ctx)),
          ]);
      const catalog = searchCatalog(q, permissions, limit);
      const staticGroups: SearchResultGroup[] = [
        { key: "pages", items: catalog.filter((i) => i.group === "pages") },
        {
          key: "actions",
          items: catalog.filter((i) => i.group === "actions"),
        },
      ];
      return {
        success: true,
        data: {
          query: q,
          groups: [...groups, ...staticGroups].filter((g) => g.items.length),
          meta,
        },
      };
    } catch (error) {
      if (isForbiddenError(error)) {
        return { success: false, error: error.message };
      }
      logger.error({ err: error }, "[discovery] globalSearch failed");
      return { success: false, error: "Search failed" };
    }
  }
);
