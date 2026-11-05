// src/lib/validations/subscriptions.ts
/**
 * Zod schemas shared by subscription server actions and REST routes.
 */
import {
  parseMultiEnum,
  parseOptionalMultiValue,
} from "@/lib/filters/multi-value";
import type {
  SubscriptionFilterOptions,
  SubscriptionScope,
  SubscriptionSortBy,
  SubscriptionSortOptions,
} from "@/types/subscription";
import {
  AttachmentKind,
  BillingCycle,
  SubscriptionStatus,
} from "@prisma/client";
import { z } from "zod";

export const subscriptionIdSchema = z.string().min(1).max(64);

export const cancelSubscriptionSchema = z.object({
  effectiveDate: z.coerce.date().optional(),
});

export const bulkUpdatePatchSchema = z
  .object({
    categoryId: z.string().min(1).nullable().optional(),
    addTagNames: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
    removeTagIds: z.array(z.string().min(1)).max(50).optional(),
    ownerId: z.string().min(1).nullable().optional(),
    costCenterId: z.string().min(1).nullable().optional(),
    archive: z.boolean().optional(),
  })
  .refine((patch) => Object.values(patch).some((v) => v !== undefined), {
    message: "Provide at least one change",
  });

export type BulkUpdatePatch = z.infer<typeof bulkUpdatePatchSchema>;

export const bulkUpdateIdsSchema = z
  .array(subscriptionIdSchema)
  .min(1)
  .max(500);

export const duplicateCheckSchema = z.object({
  name: z.string().trim().min(1).max(200),
  vendorDomain: z.string().trim().max(253).nullable().optional(),
  excludeId: subscriptionIdSchema.optional(),
});

export const lifecycleStatusActionSchema = z.object({
  action: z.enum(["pause", "resume", "archive", "restore", "cancel"]),
  effectiveDate: z.coerce.date().optional(),
});

export const commentBodySchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(4000),
});

export const attachmentKindSchema = z.nativeEnum(AttachmentKind);

export const priceChangeAckSchema = z.object({
  applyNewAmount: z.boolean().default(false),
});

export const subscriptionStatusListSchema = z.array(
  z.nativeEnum(SubscriptionStatus)
);

/** Parse a comma-separated query parameter into a trimmed string array. */
export function parseCsvParam(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/** Parse an optional numeric query parameter; invalid values become undefined. */
export function parseNumberParam(
  value: string | null | undefined
): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// ─── REST list query / body helpers ──────────────────────────────

const SCOPES: readonly SubscriptionScope[] = ["personal", "workspace", "all"];
const SORT_KEYS: readonly SubscriptionSortBy[] = [
  "renewalDate",
  "amount",
  "createdAt",
  "appName",
  "status",
  "category",
  "owner",
];

function parseBool(value: string | null): boolean | undefined {
  if (value == null) return undefined;
  return value === "true" || value === "1";
}

/** Translate query params into the server-action filter contract. */
export function parseSubscriptionListQuery(searchParams: URLSearchParams): {
  filter: SubscriptionFilterOptions;
  sort: SubscriptionSortOptions;
  page: number;
  limit: number;
} {
  const sortByParam = searchParams.get("sortBy") ?? "renewalDate";
  const sortBy = SORT_KEYS.includes(sortByParam as SubscriptionSortBy)
    ? (sortByParam as SubscriptionSortBy)
    : "renewalDate";
  const sortOrder = searchParams.get("sortOrder") === "desc" ? "desc" : "asc";
  const scopeParam = searchParams.get("scope");
  const list = (...keys: string[]) =>
    parseOptionalMultiValue(keys.flatMap((k) => searchParams.getAll(k)));
  const statuses = parseMultiEnum(
    [...searchParams.getAll("status"), ...searchParams.getAll("statuses")],
    Object.values(SubscriptionStatus)
  );

  // Every id facet accepts `key=a,b`, repeated keys or the plural key.
  const filter: SubscriptionFilterOptions = {
    statuses,
    appId: searchParams.get("appId") ?? undefined,
    billingCycles: parseMultiEnum(
      [
        ...searchParams.getAll("billingCycle"),
        ...searchParams.getAll("billingCycles"),
      ],
      Object.values(BillingCycle)
    ),
    search: searchParams.get("search") ?? undefined,
    renewingWithinDays: parseNumberParam(
      searchParams.get("renewingWithinDays")
    ),
    categoryIds: list("categoryId", "categoryIds"),
    parentCategoryIds: list("parentCategoryId", "parentCategoryIds"),
    tagIds: parseCsvParam(searchParams.get("tagIds")),
    ownerIds: list("ownerId", "ownerIds"),
    teamIds: list("teamId", "teamIds"),
    costCenterIds: list("costCenterId", "costCenterIds"),
    paymentMethodIds: list("paymentMethodId", "paymentMethodIds"),
    amountMin: parseNumberParam(searchParams.get("amountMin")),
    amountMax: parseNumberParam(searchParams.get("amountMax")),
    scope: SCOPES.includes(scopeParam as SubscriptionScope)
      ? (scopeParam as SubscriptionScope)
      : undefined,
    includeArchived: parseBool(searchParams.get("includeArchived")),
  };
  if (!filter.tagIds?.length) delete filter.tagIds;

  return {
    filter,
    sort: { sortBy, sortOrder },
    page: Math.max(1, parseNumberParam(searchParams.get("page")) ?? 1),
    limit: Math.max(1, parseNumberParam(searchParams.get("limit")) ?? 20),
  };
}

/** JSON body → FormData (arrays append repeated keys, objects are JSON strings). */
export function jsonBodyToFormData(body: unknown): FormData {
  const formData = new FormData();
  Object.entries((body as Record<string, unknown>) ?? {}).forEach(
    ([key, value]) => {
      if (value === undefined || value === null) return;
      if (Array.isArray(value)) {
        value.forEach((item) => formData.append(key, String(item)));
      } else if (typeof value === "object") {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    }
  );
  return formData;
}
