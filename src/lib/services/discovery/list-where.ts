// src/lib/services/discovery/list-where.ts
/**
 * Pure translation of a `SubscriptionListFilter` / sort into Prisma clauses.
 * Kept separate from the action so it can be unit-tested without a database.
 */
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
  if (filter.categoryId) and.push({ categoryId: filter.categoryId });
  else if (filter.parentCategoryId) {
    and.push({
      OR: [
        { categoryId: filter.parentCategoryId },
        { category: { parentId: filter.parentCategoryId } },
      ],
    });
  }
  if (filter.tagIds?.length) {
    and.push({ tags: { some: { tagId: { in: filter.tagIds } } } });
  }
  if (filter.ownerId) and.push({ ownerId: filter.ownerId });
  if (filter.teamId) {
    and.push({
      OR: [
        { teamId: filter.teamId },
        { subscriptionTeams: { some: { teamId: filter.teamId } } },
      ],
    });
  }
  if (filter.costCenterId) and.push({ costCenterId: filter.costCenterId });
  if (filter.paymentMethodId) {
    and.push({ paymentMethodId: filter.paymentMethodId });
  }
  if (filter.billingCycle) and.push({ billingCycle: filter.billingCycle });
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
