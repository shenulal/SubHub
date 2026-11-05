// src/lib/services/discovery/filter-params.ts
/**
 * Pure helpers that turn subscription-list state (filter, sort, pagination)
 * into URL search params and back. The URL is the single source of truth for
 * the list page so every view is shareable.
 */
import {
  MULTI_VALUE_SEPARATOR,
  parseMultiEnum,
  parseOptionalMultiValue,
} from "@/lib/filters/multi-value";
import {
  SUBSCRIPTION_SORT_FIELDS,
  WORKSPACE_SCOPES,
  type SubscriptionListFilter,
  type SubscriptionListQuery,
  type SubscriptionListSort,
  type SubscriptionSortField,
  type WorkspaceScope,
} from "@/types/discovery";
import { BillingCycle, SubscriptionStatus } from "@prisma/client";

export const DEFAULT_SORT: SubscriptionListSort = {
  sortBy: "renewalDate",
  sortOrder: "asc",
};
export const DEFAULT_PAGE = 1;
export const LIST_SEPARATOR = MULTI_VALUE_SEPARATOR;

type ParamSource =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function readParam(source: ParamSource, key: string): string | undefined {
  if (source instanceof URLSearchParams) {
    const value = source.get(key);
    return value === null ? undefined : value;
  }
  const value = source[key];
  return Array.isArray(value) ? value[0] : value;
}

/** Every value of a key (repeated keys and comma-separated lists). */
function readAll(source: ParamSource, key: string): string[] {
  if (source instanceof URLSearchParams) return source.getAll(key);
  const value = source[key];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Multi-value param; accepts the legacy single value (`?owner=u1`). */
function parseList(
  source: ParamSource,
  ...keys: string[]
): string[] | undefined {
  return parseOptionalMultiValue(keys.flatMap((key) => readAll(source, key)));
}

function parseNumber(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function parseBoolean(raw: string | undefined): boolean | undefined {
  if (raw === undefined) return undefined;
  return raw === "1" || raw === "true";
}

function parseEnum<T extends string>(
  raw: string | undefined,
  allowed: readonly T[]
): T | undefined {
  return raw && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : undefined;
}

const STATUS_VALUES = Object.values(SubscriptionStatus) as SubscriptionStatus[];
const CYCLE_VALUES = Object.values(BillingCycle) as BillingCycle[];

/**
 * Parse the filter portion of the URL. Unknown or malformed values are
 * dropped. Multi-value facets are comma-separated; `parentCategory` is the
 * legacy key for a parent category and folds into `categoryIds`.
 */
export function parseFilterParams(source: ParamSource): SubscriptionListFilter {
  const filter: SubscriptionListFilter = {
    search: readParam(source, "q")?.trim() || undefined,
    categoryIds: parseList(source, "category", "parentCategory"),
    tagIds: parseList(source, "tags"),
    statuses: parseMultiEnum(readAll(source, "status"), STATUS_VALUES),
    includeArchived: parseBoolean(readParam(source, "archived")),
    ownerIds: parseList(source, "owner"),
    teamIds: parseList(source, "team"),
    costCenterIds: parseList(source, "costCenter"),
    paymentMethodIds: parseList(source, "paymentMethod"),
    billingCycles: parseMultiEnum(readAll(source, "cycle"), CYCLE_VALUES),
    amountMin: parseNumber(readParam(source, "amountMin")),
    amountMax: parseNumber(readParam(source, "amountMax")),
    renewingWithinDays: parseNumber(readParam(source, "renewingWithin")),
    trialOnly: parseBoolean(readParam(source, "trial")),
    scope: parseEnum<WorkspaceScope>(
      readParam(source, "scope"),
      WORKSPACE_SCOPES
    ),
  };
  return stripUndefined(filter);
}

export function parseSortParams(source: ParamSource): SubscriptionListSort {
  const sortBy =
    parseEnum<SubscriptionSortField>(
      readParam(source, "sort"),
      SUBSCRIPTION_SORT_FIELDS
    ) ?? DEFAULT_SORT.sortBy;
  const sortOrder =
    parseEnum(readParam(source, "order"), ["asc", "desc"] as const) ??
    DEFAULT_SORT.sortOrder;
  return { sortBy, sortOrder };
}

export function parsePageParams(
  source: ParamSource,
  defaultLimit: number
): { page: number; limit: number } {
  const page = Math.max(
    DEFAULT_PAGE,
    Math.trunc(parseNumber(readParam(source, "page")) ?? DEFAULT_PAGE)
  );
  const limit = Math.trunc(
    parseNumber(readParam(source, "limit")) ?? defaultLimit
  );
  return { page, limit: limit > 0 ? limit : defaultLimit };
}

export function parseListQuery(
  source: ParamSource,
  defaultLimit: number
): SubscriptionListQuery {
  return {
    filter: parseFilterParams(source),
    sort: parseSortParams(source),
    ...parsePageParams(source, defaultLimit),
  };
}

/** Serialise state back to URL params. Defaults are omitted to keep URLs short. */
export function serializeListQuery(
  query: Partial<SubscriptionListQuery>,
  defaultLimit?: number
): URLSearchParams {
  const params = new URLSearchParams();
  const f = query.filter ?? {};
  const set = (key: string, value: string | undefined) => {
    if (value !== undefined && value !== "") params.set(key, value);
  };
  const list = (values: readonly string[] | undefined) =>
    values?.length ? values.join(LIST_SEPARATOR) : undefined;
  set("q", f.search);
  set("category", list(f.categoryIds));
  set("tags", list(f.tagIds));
  set("status", list(f.statuses));
  set("archived", f.includeArchived ? "1" : undefined);
  set("owner", list(f.ownerIds));
  set("team", list(f.teamIds));
  set("costCenter", list(f.costCenterIds));
  set("paymentMethod", list(f.paymentMethodIds));
  set("cycle", list(f.billingCycles));
  set("amountMin", f.amountMin !== undefined ? String(f.amountMin) : undefined);
  set("amountMax", f.amountMax !== undefined ? String(f.amountMax) : undefined);
  set(
    "renewingWithin",
    f.renewingWithinDays !== undefined
      ? String(f.renewingWithinDays)
      : undefined
  );
  set("trial", f.trialOnly ? "1" : undefined);
  set("scope", f.scope);

  if (query.sort && query.sort.sortBy !== DEFAULT_SORT.sortBy) {
    set("sort", query.sort.sortBy);
  }
  if (query.sort && query.sort.sortOrder !== DEFAULT_SORT.sortOrder) {
    set("order", query.sort.sortOrder);
  }
  if (query.page && query.page > DEFAULT_PAGE) set("page", String(query.page));
  if (query.limit && query.limit !== defaultLimit) {
    set("limit", String(query.limit));
  }
  return params;
}

/** Number of active (non-default) filter facets — used for the badge count. */
export function countActiveFilters(filter: SubscriptionListFilter): number {
  return Object.entries(filter).filter(([key, value]) => {
    if (key === "scope") return false;
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== "" && value !== false;
  }).length;
}

export function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

/** Preset used by the "Archived" sub-nav entry. */
export const ARCHIVED_PRESET: SubscriptionListFilter = {
  includeArchived: true,
  statuses: ["ARCHIVED"],
};
