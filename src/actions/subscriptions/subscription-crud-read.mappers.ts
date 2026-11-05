// src/actions/subscriptions/subscription-crud-read.mappers.ts
/**
 * Prisma include shapes and row → DTO mappers for subscription reads.
 * Mappers are defensive about missing relations so partial fixtures work.
 */
import type {
  SubscriptionDetail,
  SubscriptionListItem,
} from "@/types/subscription";
import type { Prisma } from "@prisma/client";

export const SUBSCRIPTION_LIST_INCLUDE = {
  app: {
    select: {
      id: true,
      name: true,
      customLogoUrl: true,
      customWebsite: true,
      catalogId: true,
      cancellationUrl: true,
      cancellationNotes: true,
      catalog: { select: { logoUrl: true, website: true } },
    },
  },
  team: { select: { id: true, name: true } },
  subscriptionTeams: {
    include: { team: { select: { id: true, name: true } } },
  },
  assignedUsers: {
    include: { user: { select: { id: true, name: true, email: true } } },
  },
  category: {
    select: {
      id: true,
      name: true,
      color: true,
      parent: { select: { name: true } },
    },
  },
  tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
  owner: { select: { id: true, name: true, email: true } },
  paymentMethod: { select: { id: true, name: true } },
  costCenter: { select: { id: true, code: true, name: true } },
} satisfies Prisma.SubscriptionInclude;

export const SUBSCRIPTION_DETAIL_INCLUDE = {
  ...SUBSCRIPTION_LIST_INCLUDE,
  taxRate: { select: { id: true, name: true, ratePercent: true } },
  customFieldValues: {
    include: {
      field: { select: { id: true, key: true, label: true, fieldType: true } },
    },
  },
} satisfies Prisma.SubscriptionInclude;

type ListRow = Prisma.SubscriptionGetPayload<{
  include: typeof SUBSCRIPTION_LIST_INCLUDE;
}>;
type DetailRow = Prisma.SubscriptionGetPayload<{
  include: typeof SUBSCRIPTION_DETAIL_INCLUDE;
}>;

/** Partial rows are tolerated (older fixtures/tests omit the new relations). */
type Loose<T> = { [K in keyof T]?: T[K] | null | undefined };

function toNumber(value: unknown): number {
  return value == null ? 0 : Number(value);
}

function toNullableNumber(value: unknown): number | null {
  return value == null ? null : Number(value);
}

export function mapSubscriptionListItem(
  row: Loose<ListRow> & { id: string; appId: string }
): SubscriptionListItem {
  const app = row.app;
  return {
    id: row.id,
    appId: row.appId,
    appName: app?.name ?? "",
    appLogoUrl: app?.customLogoUrl || app?.catalog?.logoUrl || null,
    status: row.status ?? "ACTIVE",
    billingCycle: row.billingCycle ?? "MONTHLY",
    billingType: row.billingType ?? "FLAT_RATE",
    amount: toNumber(row.amount),
    perSeatPrice: toNullableNumber(row.perSeatPrice),
    currency: row.currency ?? "",
    totalLicenses: row.totalLicenses ?? null,
    usedLicenses: row.usedLicenses ?? null,
    startDate: row.startDate ?? new Date(0),
    endDate: row.endDate ?? null,
    renewalDate: row.renewalDate ?? null,
    autoRenewal: row.autoRenewal ?? true,
    createdAt: row.createdAt ?? new Date(0),
    updatedAt: row.updatedAt ?? new Date(0),
    teamId: row.teamId ?? null,
    teamName: row.team?.name ?? null,
    teams:
      row.subscriptionTeams?.map((st) => ({
        id: st.team.id,
        name: st.team.name,
      })) ?? [],
    assignedUsers:
      row.assignedUsers?.map((su) => ({
        id: su.user.id,
        name: su.user.name,
        email: su.user.email,
      })) ?? [],
    category: row.category
      ? {
          id: row.category.id,
          name: row.category.name,
          parentName: row.category.parent?.name ?? null,
          color: row.category.color ?? null,
        }
      : null,
    tags:
      row.tags?.map((st) => ({
        id: st.tag.id,
        name: st.tag.name,
        color: st.tag.color ?? null,
      })) ?? [],
    owner: row.owner
      ? { id: row.owner.id, name: row.owner.name, email: row.owner.email }
      : null,
    isPersonal: row.isPersonal ?? false,
    isTrial: row.isTrial ?? false,
    trialEndsAt: row.trialEndsAt ?? null,
    cancellationDeadline: row.cancellationDeadline ?? null,
    paymentMethod: row.paymentMethod
      ? { id: row.paymentMethod.id, name: row.paymentMethod.name }
      : null,
    costCenter: row.costCenter
      ? {
          id: row.costCenter.id,
          code: row.costCenter.code,
          name: row.costCenter.name,
        }
      : null,
  };
}

export function mapSubscriptionDetail(
  row: Loose<DetailRow> & { id: string; appId: string }
): SubscriptionDetail {
  const base = mapSubscriptionListItem(row);
  return {
    ...base,
    contractUrl: row.contractUrl ?? null,
    notes: row.notes ?? null,
    renewalAlert30: row.renewalAlert30 ?? true,
    renewalAlert60: row.renewalAlert60 ?? false,
    renewalAlert90: row.renewalAlert90 ?? false,
    team: row.team ?? null,
    noticePeriodDays: row.noticePeriodDays ?? null,
    reminderLeadDays: row.reminderLeadDays ?? [],
    pausedAt: row.pausedAt ?? null,
    archivedAt: row.archivedAt ?? null,
    lastDetectedAmount: toNullableNumber(row.lastDetectedAmount),
    cancellationUrl: row.cancellationUrl ?? null,
    cancellationNotes: row.cancellationNotes ?? null,
    taxRate: row.taxRate
      ? {
          id: row.taxRate.id,
          name: row.taxRate.name,
          ratePercent: toNumber(row.taxRate.ratePercent),
        }
      : null,
    customFieldValues:
      row.customFieldValues?.map((cfv) => ({
        fieldId: cfv.field.id,
        key: cfv.field.key,
        label: cfv.field.label,
        fieldType: cfv.field.fieldType,
        value: cfv.value,
      })) ?? [],
    app: {
      catalogId: row.app?.catalogId ?? null,
      website: row.app?.customWebsite ?? row.app?.catalog?.website ?? null,
      cancellationUrl: row.app?.cancellationUrl ?? null,
      cancellationNotes: row.app?.cancellationNotes ?? null,
    },
  };
}
