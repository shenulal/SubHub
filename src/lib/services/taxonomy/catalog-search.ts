// src/lib/services/taxonomy/catalog-search.ts
/** Pure ranking for catalog search: name prefix > alias prefix > contains. */

export interface CatalogSearchable {
  name: string;
  aliases: string[];
}

export const CATALOG_SEARCH_DEFAULT_LIMIT = 10;
export const CATALOG_SEARCH_MAX_LIMIT = 50;

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Lower score sorts first. Returns null when the item does not match. */
export function scoreCatalogItem(
  item: CatalogSearchable,
  q: string
): number | null {
  const name = item.name.toLowerCase();
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  const aliases = item.aliases.map((a) => a.toLowerCase());
  if (aliases.some((a) => a === q)) return 2;
  if (aliases.some((a) => a.startsWith(q))) return 3;
  if (name.includes(q)) return 4;
  if (aliases.some((a) => a.includes(q))) return 5;
  return null;
}

export function rankCatalogItems<T extends CatalogSearchable>(
  items: T[],
  query: string,
  limit = CATALOG_SEARCH_DEFAULT_LIMIT
): T[] {
  const q = normalizeQuery(query);
  if (!q) return [];
  return items
    .map((item) => ({ item, score: scoreCatalogItem(item, q) }))
    .filter((x): x is { item: T; score: number } => x.score !== null)
    .sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name))
    .slice(0, Math.min(limit, CATALOG_SEARCH_MAX_LIMIT))
    .map((x) => x.item);
}

/** Coerces Prisma `Json` cancellation steps to a clean string array. */
export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0
  );
}
