// src/lib/filters/multi-value.ts
/**
 * Helpers for multi-value filters (several owners, teams, statuses …).
 *
 * Contract shared by URLs, server actions and REST endpoints:
 * - a filter value is a list of ids; an empty / missing list means "no filter"
 * - in URLs the list is comma-separated (`?team=a,b`); repeated keys
 *   (`?team=a&team=b`) and the legacy single value (`?team=a`) are accepted
 * - legacy saved views stored a single string; it is read as a one-item list
 */
import { z } from "zod";

export const MULTI_VALUE_SEPARATOR = ",";
/** Upper bound for ids in one filter (keeps `IN (...)` clauses small). */
export const MAX_MULTI_VALUES = 100;

type RawMulti = string | readonly string[] | null | undefined;

/** Split, trim and de-duplicate one or several raw values. */
export function parseMultiValue(raw: RawMulti): string[] {
  if (raw === null || raw === undefined) return [];
  const parts = (typeof raw === "string" ? [raw] : raw).flatMap((v) =>
    String(v).split(MULTI_VALUE_SEPARATOR)
  );
  const items = parts.map((s) => s.trim()).filter(Boolean);
  return Array.from(new Set(items)).slice(0, MAX_MULTI_VALUES);
}

/** Like `parseMultiValue` but `undefined` when nothing is selected. */
export function parseOptionalMultiValue(raw: RawMulti): string[] | undefined {
  const items = parseMultiValue(raw);
  return items.length ? items : undefined;
}

/** Keep only values from an allowed list (enum filters). */
export function parseMultiEnum<T extends string>(
  raw: RawMulti,
  allowed: readonly T[]
): T[] | undefined {
  const items = parseMultiValue(raw).filter((v): v is T =>
    (allowed as readonly string[]).includes(v)
  );
  return items.length ? items : undefined;
}

/** Serialise for a URL; `undefined` for an empty selection. */
export function serializeMultiValue(
  values: readonly string[] | null | undefined
): string | undefined {
  return values?.length ? values.join(MULTI_VALUE_SEPARATOR) : undefined;
}

/** All values of a key from URLSearchParams (repeated or comma-separated). */
export function readMultiParam(
  params: URLSearchParams,
  key: string
): string[] | undefined {
  return parseOptionalMultiValue(params.getAll(key));
}

/** Merge a legacy single value and a list into one list (or `undefined`). */
export function mergeLegacyValue(
  list: readonly string[] | null | undefined,
  single: string | null | undefined
): string[] | undefined {
  return parseOptionalMultiValue([
    ...(list ?? []),
    ...(single ? [single] : []),
  ]);
}

/**
 * Prisma `in` clause for a list filter; `undefined` (= no filter) when empty.
 * A single value collapses to equality so query plans stay identical.
 */
export function inFilter<T extends string>(
  values: readonly T[] | null | undefined
): T | { in: T[] } | undefined {
  if (!values?.length) return undefined;
  return values.length === 1 ? values[0] : { in: [...values] };
}

/**
 * zod schema for a multi-value filter field. Accepts an array, a
 * comma-separated string or a legacy single value; outputs `string[]`
 * (or `undefined` when empty).
 */
export function multiValueSchema<T extends z.ZodType<string>>(item: T) {
  return z.preprocess((value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }
    if (typeof value === "string" || Array.isArray(value)) {
      return parseOptionalMultiValue(value as string | string[]);
    }
    return value;
  }, z.array(item).max(MAX_MULTI_VALUES).optional());
}
