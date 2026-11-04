// src/lib/services/taxonomy/category-tree.ts
/** Pure helpers for the two-level category hierarchy. No I/O. */
import type { CategoryNode, CategoryRow } from "@/types/taxonomy";

/** URL-safe slug: lower-case, ASCII letters/digits, single hyphens. */
export function slugify(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "category";
}

/**
 * Returns `base` if it is free among `taken`, otherwise `base-2`, `base-3`, …
 * Comparison is case-insensitive.
 */
export function nextUniqueSlug(base: string, taken: Iterable<string>): string {
  const set = new Set(Array.from(taken, (s) => s.toLowerCase()));
  if (!set.has(base)) return base;
  let i = 2;
  while (set.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

function bySortOrder(a: CategoryNode, b: CategoryNode): number {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
}

/**
 * Builds a sorted two-level tree. Rows whose parent is missing (e.g. archived
 * parent filtered out) are promoted to the root so nothing disappears.
 */
export function buildCategoryTree(rows: CategoryRow[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>();
  for (const row of rows) nodes.set(row.id, { ...row, children: [] });

  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  for (const root of roots) root.children.sort(bySortOrder);
  return roots.sort(bySortOrder);
}

/** Flattens a tree back to rows (depth-first, parents first). */
export function flattenCategoryTree(tree: CategoryNode[]): CategoryNode[] {
  return tree.flatMap((n) => [n, ...n.children]);
}

/** Finds a node (root or child) by id. */
export function findCategoryNode(
  tree: CategoryNode[],
  id: string | null | undefined
): CategoryNode | undefined {
  if (!id) return undefined;
  return flattenCategoryTree(tree).find((n) => n.id === id);
}

/** Converts a Prisma Decimal / string / number budget to a plain number. */
export function toNumberOrNull(
  value: { toNumber(): number } | number | string | null | undefined
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return value.toNumber();
}
