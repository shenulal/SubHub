// src/lib/validations/discovery.ts
/**
 * Zod schemas for the discovery area (filters, saved views, search, scope).
 * Every server action and route in `src/actions/discovery` validates through these.
 */
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

export const subscriptionFilterSchema = z
  .object({
    search: z.string().trim().max(SEARCH_QUERY_MAX).optional(),
    categoryId: idSchema.optional(),
    parentCategoryId: idSchema.optional(),
    tagIds: z.array(idSchema).max(MAX_FILTER_IDS).optional(),
    statuses: z.array(z.nativeEnum(SubscriptionStatus)).optional(),
    includeArchived: z.boolean().optional(),
    ownerId: idSchema.optional(),
    teamId: idSchema.optional(),
    costCenterId: idSchema.optional(),
    paymentMethodId: idSchema.optional(),
    billingCycle: z.nativeEnum(BillingCycle).optional(),
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

export const categorySpendQuerySchema = z.object({
  ownerId: idSchema.optional(),
  teamId: idSchema.optional(),
  scope: workspaceScopeSchema.optional(),
});

export type SavedViewInput = z.infer<typeof savedViewInputSchema>;
export type SavedViewUpdateInput = z.infer<typeof savedViewUpdateSchema>;
