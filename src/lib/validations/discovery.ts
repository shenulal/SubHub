// src/lib/validations/discovery.ts
/**
 * Zod schemas for the discovery area (filters, saved views, search, scope).
 * Every server action and route in `src/actions/discovery` validates through these.
 */
import {
  mergeLegacyValue,
  multiValueSchema,
  parseMultiValue,
} from "@/lib/filters/multi-value";
import { SUBSCRIPTION_SORT_FIELDS, WORKSPACE_SCOPES } from "@/types/discovery";
import { BillingCycle, SubscriptionStatus } from "@prisma/client";
import { z } from "zod";

export const SAVED_VIEW_NAME_MAX = 60;
export const SEARCH_QUERY_MAX = 120;
export const MAX_FILTER_IDS = 50;

const idSchema = z.string().min(1).max(64);

export const workspaceScopeSchema = z.enum(WORKSPACE_SCOPES);

export const subscriptionSortSchema = z.object({
  sortBy: z.enum(SUBSCRIPTION_SORT_FIELDS),
  sortOrder: z.enum(["asc", "desc"]),
});

/**
 * Legacy single-value keys (old URLs, saved views, mobile clients) and the
 * multi-value key that replaced each of them.
 */
const LEGACY_FILTER_KEYS: Record<string, string> = {
  categoryId: "categoryIds",
  parentCategoryId: "categoryIds",
  ownerId: "ownerIds",
  teamId: "teamIds",
  costCenterId: "costCenterIds",
  paymentMethodId: "paymentMethodIds",
  billingCycle: "billingCycles",
};

/**
 * Rewrites legacy single-value keys into their multi-value replacements so
 * saved views created before multi-select still load (`ownerId: "u1"` →
 * `ownerIds: ["u1"]`). Non-objects are returned unchanged for zod to reject.
 */
export function normalizeLegacySubscriptionFilter(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const source = raw as Record<string, unknown>;
  const kept = Object.entries(source).filter(
    ([key]) => !(key in LEGACY_FILTER_KEYS)
  );
  const merged = Object.entries(LEGACY_FILTER_KEYS).reduce<
    Record<string, string[] | undefined>
  >((acc, [legacy, plural]) => {
    const single = source[legacy];
    if (typeof single !== "string" || !single) return acc;
    const current = acc[plural] ?? toStringList(source[plural]);
    return { ...acc, [plural]: mergeLegacyValue(current, single) };
  }, {});
  return { ...Object.fromEntries(kept), ...stripEmpty(merged) };
}

function toStringList(value: unknown): string[] {
  if (typeof value === "string") return parseMultiValue(value);
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function stripEmpty(
  record: Record<string, string[] | undefined>
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, string[]] =>
      Boolean(entry[1]?.length)
    )
  );
}

const subscriptionFilterObjectSchema = z
  .object({
    search: z.string().trim().max(SEARCH_QUERY_MAX).optional(),
    categoryIds: multiValueSchema(idSchema),
    tagIds: multiValueSchema(idSchema),
    statuses: multiValueSchema(z.nativeEnum(SubscriptionStatus)),
    includeArchived: z.boolean().optional(),
    ownerIds: multiValueSchema(idSchema),
    teamIds: multiValueSchema(idSchema),
    costCenterIds: multiValueSchema(idSchema),
    paymentMethodIds: multiValueSchema(idSchema),
    billingCycles: multiValueSchema(z.nativeEnum(BillingCycle)),
    amountMin: z.number().min(0).optional(),
    amountMax: z.number().min(0).optional(),
    renewingWithinDays: z.number().int().min(1).max(3650).optional(),
    trialOnly: z.boolean().optional(),
    scope: workspaceScopeSchema.optional(),
  })
  .strict()
  .refine(
    (f) =>
      f.amountMin === undefined ||
      f.amountMax === undefined ||
      f.amountMin <= f.amountMax,
    { message: "amountMin must be ≤ amountMax", path: ["amountMin"] }
  );

/**
 * Subscription list filter. Every facet is a list (empty = all); legacy
 * single-value keys are accepted and normalised first.
 */
export const subscriptionFilterSchema = z.preprocess(
  normalizeLegacySubscriptionFilter,
  subscriptionFilterObjectSchema
);

export const savedViewInputSchema = z.object({
  entity: z.string().min(1).max(40).default("subscriptions"),
  name: z.string().trim().min(1).max(SAVED_VIEW_NAME_MAX),
  filters: subscriptionFilterSchema,
  sort: subscriptionSortSchema.nullable().optional(),
  isShared: z.boolean().default(false),
});

export const savedViewUpdateSchema = savedViewInputSchema
  .partial()
  .extend({ id: idSchema });

export const globalSearchInputSchema = z.object({
  query: z.string().trim().max(SEARCH_QUERY_MAX),
  limit: z.number().int().min(1).max(50).optional(),
});

export const pipelineQuerySchema = z.object({
  scope: workspaceScopeSchema.optional(),
});

/**
 * Dashboard "Spend by category" filter: several owners / teams (empty = all).
 * The legacy single `ownerId` / `teamId` keys are still accepted.
 */
export const categorySpendQuerySchema = z
  .object({
    ownerIds: multiValueSchema(idSchema),
    teamIds: multiValueSchema(idSchema),
    ownerId: idSchema.optional(),
    teamId: idSchema.optional(),
    scope: workspaceScopeSchema.optional(),
  })
  .transform(({ ownerId, teamId, ownerIds, teamIds, scope }) => ({
    ownerIds: mergeLegacyValue(ownerIds, ownerId),
    teamIds: mergeLegacyValue(teamIds, teamId),
    scope,
  }));

export type SavedViewInput = z.infer<typeof savedViewInputSchema>;
export type SavedViewUpdateInput = z.infer<typeof savedViewUpdateSchema>;
