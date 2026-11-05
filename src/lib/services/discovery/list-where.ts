// src/lib/services/discovery/list-where.ts
/**
 * Pure translation of a `SubscriptionListFilter` / sort into Prisma clauses.
 * Kept separate from the action so it can be unit-tested without a database.
 */
import { inFilter } from "@/lib/filters/multi-value";
import type {
  SubscriptionListFilter,
  SubscriptionListSort,
} from "@/types/discovery";
import type { Prisma, SubscriptionStatus } from "@prisma/client";

const MS_PER_DAY = 86_400_000;

/** Statuses shown when the filter does not name any and archived is hidden. */
export const DEFAULT_VISIBLE_STATUSES: SubscriptionStatus[] = [
  "ACTIVE",
  "PENDING",
  "PAUSED",
  "EXPIRED",
  "CANCELLED",
];

/**
 * Multi-value facets (empty list = no filter). A category id matches the
 * category itself and, for a parent, every subcategory under it; a team id
 * matches the owning team or any additional team on the subscription.
 */
export function facetClauses(
  filter: SubscriptionListFilter
): Prisma.SubscriptionWhereInput[] {
  const and: Prisma.SubscriptionWhereInput[] = [];
  const categories = filter.categoryIds;
  if (categories?.length) {
    and.push({
      OR: [
        { categoryId: inFilter(categories) },
        { category: { parentId: inFilter(categories) } },
      ],
    });
  }
  if (filter.tagIds?.length) {
    and.push({ tags: { some: { tagId: { in: filter.tagIds } } } });
  }
  const owners = inFilter(filter.ownerIds);
  if (owners) and.push({ ownerId: owners });
  const teams = inFilter(filter.teamIds);
  if (teams) {
    and.push({
      OR: [
        { teamId: teams },
        { subscriptionTeams: { some: { teamId: teams } } },
      ],
    });
  }
  const costCenters = inFilter(filter.costCenterIds);
  if (costCenters) and.push({ costCenterId: costCenters });
  const paymentMethods = inFilter(filter.paymentMethodIds);
  if (paymentMethods) and.push({ paymentMethodId: paymentMethods });
  const cycles = inFilter(filter.billingCycles);
  if (cycles) and.push({ billingCycle: cycles });
  return and;
}

export function filterToWhere(
  filter: SubscriptionListFilter,
  now: Date = new Date()
): Prisma.SubscriptionWhereInput {
  const and: Prisma.SubscriptionWhereInput[] = [];

  if (filter.statuses?.length) {
    and.push({ status: { in: filter.statuses } });
  } else if (!filter.includeArchived) {
    and.push({ status: { in: DEFAULT_VISIBLE_STATUSES } });
  }

  if (filter.search) {
    const q: Prisma.StringFilter = {
      contains: filter.search,
      mode: "insensitive",
    };
    and.push({
      OR: [
        { app: { name: q } },
        { app: { catalog: { vendorName: q } } },
        { notes: q },
        { tags: { some: { tag: { name: q } } } },
      ],
    });
  }
  and.push(...facetClauses(filter));
  if (filter.amountMin !== undefined || filter.amountMax !== undefined) {
    and.push({
      amount: {
        ...(filter.amountMin !== undefined && { gte: filter.amountMin }),
        ...(filter.amountMax !== undefined && { lte: filter.amountMax }),
      },
    });
  }
  if (filter.renewingWithinDays) {
    and.push({
      renewalDate: {
        gte: now,
        lte: new Date(now.getTime() + filter.renewingWithinDays * MS_PER_DAY),
      },
    });
  }
  if (filter.trialOnly) and.push({ isTrial: true });

  return and.length ? { AND: and } : {};
}

export function sortToOrderBy(
  sort: SubscriptionListSort
): Prisma.SubscriptionOrderByWithRelationInput[] {
  const dir = sort.sortOrder;
  switch (sort.sortBy) {
    case "appName":
      return [{ app: { name: dir } }];
    case "category":
      return [{ category: { name: dir } }, { app: { name: "asc" } }];
    case "owner":
      return [{ owner: { name: dir } }, { app: { name: "asc" } }];
    case "status":
      return [{ status: dir }, { renewalDate: "asc" }];
    case "amount":
      return [{ amount: dir }];
    case "createdAt":
      return [{ createdAt: dir }];
    case "renewalDate":
    default:
      return [{ renewalDate: dir }, { app: { name: "asc" } }];
  }
}
