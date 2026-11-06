// src/actions/subscriptions/subscription-crud-read.where.ts
/**
 * Pure builders for the subscription list query: where clause, order-by.
 * Kept free of I/O so filter semantics can be unit-tested directly.
 */
import { inFilter, mergeLegacyValue } from "@/lib/filters/multi-value";
import type {
  SubscriptionFilterOptions,
  SubscriptionSortOptions,
} from "@/types/subscription";
import type { Prisma } from "@prisma/client";

export interface ListVisibilityContext {
  organizationId: string;
  userId: string;
  /** Legacy role used for team/assignment visibility (kept for compatibility). */
  role: string;
  teamId: string | null;
  /** True when the caller holds `subscriptions:read_all`. */
  canReadAll: boolean;
}

type Where = Prisma.SubscriptionWhereInput;

function statusClause(filter: SubscriptionFilterOptions): Where {
  if (filter.statuses?.length) return { status: { in: filter.statuses } };
  if (filter.status) return { status: filter.status };
  if (!filter.includeArchived) return { status: { not: "ARCHIVED" } };
  return {};
}

/**
 * Personal subscriptions are visible only to their owner; `all` additionally
 * requires `subscriptions:read_all` to see other members' personal items.
 */
function scopeClause(
  filter: SubscriptionFilterOptions,
  ctx: ListVisibilityContext
): Where {
  const scope = filter.scope ?? "workspace";
  if (scope === "personal") return { isPersonal: true, ownerId: ctx.userId };
  if (scope === "workspace") return { isPersonal: false };
  if (ctx.canReadAll) return {};
  return {
    OR: [{ isPersonal: false }, { isPersonal: true, ownerId: ctx.userId }],
  };
}

function searchClause(search: string): Where {
  const contains = { contains: search, mode: "insensitive" as const };
  return {
    OR: [
      { app: { name: contains } },
      { app: { customWebsite: contains } },
      { app: { catalog: { vendorName: contains } } },
      { notes: contains },
      { tags: { some: { tag: { name: contains } } } },
      { customFieldValues: { some: { value: contains } } },
    ],
  };
}

/** Single value + list → one list (`undefined` when neither is set). */
function values<T extends string>(
  single: T | undefined,
  list: T[] | undefined
): T[] | undefined {
  return mergeLegacyValue(list, single) as T[] | undefined;
}

/** Equality / `in` filters live at the top level of the where clause. */
function scalarFilters(filter: SubscriptionFilterOptions): Where {
  const cycles = inFilter(values(filter.billingCycle, filter.billingCycles));
  const categories = inFilter(values(filter.categoryId, filter.categoryIds));
  const owners = inFilter(values(filter.ownerId, filter.ownerIds));
  const costCenters = inFilter(
    values(filter.costCenterId, filter.costCenterIds)
  );
  const paymentMethods = inFilter(
    values(filter.paymentMethodId, filter.paymentMethodIds)
  );
  return {
    ...(filter.appId ? { appId: filter.appId } : {}),
    ...(cycles ? { billingCycle: cycles } : {}),
    ...(categories ? { categoryId: categories } : {}),
    ...(owners ? { ownerId: owners } : {}),
    ...(costCenters ? { costCenterId: costCenters } : {}),
    ...(paymentMethods ? { paymentMethodId: paymentMethods } : {}),
  };
}

function relationClauses(filter: SubscriptionFilterOptions): Where[] {
  const clauses: Where[] = [];
  const parents = inFilter(
    values(filter.parentCategoryId, filter.parentCategoryIds)
  );
  if (parents) {
    clauses.push({
      OR: [{ categoryId: parents }, { category: { parentId: parents } }],
    });
  }
  if (filter.tagIds?.length) {
    clauses.push({ tags: { some: { tagId: { in: filter.tagIds } } } });
  }
  const teams = inFilter(values(filter.teamId, filter.teamIds));
  if (teams) {
    clauses.push({
      OR: [
        { teamId: teams },
        { subscriptionTeams: { some: { teamId: teams } } },
      ],
    });
  }
  return clauses;
}

/**
 * Amount bounds are applied to the stored amount (FX-normalised bounds would
 * need a materialised base-currency column; see `monthlyAmountBase` on items).
 */
function amountClause(filter: SubscriptionFilterOptions): Where {
  if (filter.amountMin == null && filter.amountMax == null) return {};
  return {
    amount: {
      ...(filter.amountMin != null ? { gte: filter.amountMin } : {}),
      ...(filter.amountMax != null ? { lte: filter.amountMax } : {}),
    },
  };
}

function renewingClause(days: number | undefined, now: Date): Where {
  if (!days) return {};
  const future = new Date(now);
  future.setDate(future.getDate() + days);
  return { renewalDate: { gte: now, lte: future } };
}

/**
 * Visibility without `subscriptions:read_all`: a legacy VIEWER sees its
 * assignments; everyone else (MEMBER, or any custom role) sees their own team.
 */
function legacyVisibilityClause(ctx: ListVisibilityContext): Where {
  if (ctx.canReadAll) return {};
  if (ctx.role === "VIEWER") {
    return { assignedUsers: { some: { userId: ctx.userId } } };
  }
  return ctx.teamId ? { teamId: ctx.teamId } : {};
}

export function buildSubscriptionWhere(
  filter: SubscriptionFilterOptions,
  ctx: ListVisibilityContext,
  now: Date = new Date()
): Where {
  const and: Where[] = [
    legacyVisibilityClause(ctx),
    scopeClause(filter, ctx),
    amountClause(filter),
    renewingClause(filter.renewingWithinDays, now),
    ...relationClauses(filter),
    ...(filter.search ? [searchClause(filter.search)] : []),
  ].filter((clause) => Object.keys(clause).length > 0);

  return {
    organizationId: ctx.organizationId,
    ...statusClause(filter),
    ...scalarFilters(filter),
    ...(and.length ? { AND: and } : {}),
  };
}

export function buildSubscriptionOrderBy(
  sort: SubscriptionSortOptions
): Prisma.SubscriptionOrderByWithRelationInput {
  const order = sort.sortOrder ?? "asc";
  switch (sort.sortBy) {
    case "appName":
      return { app: { name: order } };
    case "category":
      return { category: { name: order } };
    case "owner":
      return { owner: { name: order } };
    case "status":
      return { status: order };
    case "amount":
    case "createdAt":
      return { [sort.sortBy]: order };
    case "renewalDate":
    default:
      return { renewalDate: order };
  }
}
