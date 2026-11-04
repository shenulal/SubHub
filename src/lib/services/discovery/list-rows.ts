// src/lib/services/discovery/list-rows.ts
/**
 * Shared Prisma select + mapper for subscription list rows (list page, bulk
 * "select all matching" and CSV export use the same shape).
 */
import type { SubscriptionListItem } from "@/types/subscription";
import type { Prisma } from "@prisma/client";

export const listRowSelect = {
  id: true,
  appId: true,
  status: true,
  billingCycle: true,
  billingType: true,
  amount: true,
  perSeatPrice: true,
  currency: true,
  totalLicenses: true,
  usedLicenses: true,
  startDate: true,
  endDate: true,
  renewalDate: true,
  autoRenewal: true,
  createdAt: true,
  updatedAt: true,
  teamId: true,
  isPersonal: true,
  isTrial: true,
  trialEndsAt: true,
  cancellationDeadline: true,
  app: {
    select: {
      name: true,
      customLogoUrl: true,
      catalog: { select: { logoUrl: true } },
    },
  },
  team: { select: { id: true, name: true } },
  subscriptionTeams: { select: { team: { select: { id: true, name: true } } } },
  assignedUsers: {
    select: { user: { select: { id: true, name: true, email: true } } },
  },
  category: {
    select: {
      id: true,
      name: true,
      color: true,
      parent: { select: { name: true } },
    },
  },
  tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
  owner: { select: { id: true, name: true, email: true } },
  paymentMethod: { select: { id: true, name: true } },
  costCenter: { select: { id: true, code: true, name: true } },
} satisfies Prisma.SubscriptionSelect;

export type ListRow = Prisma.SubscriptionGetPayload<{
  select: typeof listRowSelect;
}>;

export function toListItem(
  row: ListRow,
  monthlyAmountBase: number
): SubscriptionListItem {
  return {
    id: row.id,
    appId: row.appId,
    appName: row.app.name,
    appLogoUrl: row.app.customLogoUrl ?? row.app.catalog?.logoUrl ?? null,
    status: row.status,
    billingCycle: row.billingCycle,
    billingType: row.billingType,
    amount: Number(row.amount),
    perSeatPrice: row.perSeatPrice ? Number(row.perSeatPrice) : null,
    currency: row.currency,
    totalLicenses: row.totalLicenses,
    usedLicenses: row.usedLicenses,
    startDate: row.startDate,
    endDate: row.endDate,
    renewalDate: row.renewalDate,
    autoRenewal: row.autoRenewal,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    teamId: row.teamId,
    teamName: row.team?.name ?? null,
    teams: row.subscriptionTeams.map((st) => st.team),
    assignedUsers: row.assignedUsers.map((au) => au.user),
    category: row.category
      ? {
          id: row.category.id,
          name: row.category.name,
          color: row.category.color,
          parentName: row.category.parent?.name ?? null,
        }
      : null,
    tags: row.tags.map((t) => t.tag),
    owner: row.owner,
    isPersonal: row.isPersonal,
    isTrial: row.isTrial,
    trialEndsAt: row.trialEndsAt,
    cancellationDeadline: row.cancellationDeadline,
    monthlyAmountBase,
    paymentMethod: row.paymentMethod,
    costCenter: row.costCenter,
  };
}
