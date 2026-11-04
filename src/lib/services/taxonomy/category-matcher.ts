// src/lib/services/taxonomy/category-matcher.ts
/**
 * Pure auto-categorisation: resolves a service to one of the organisation's
 * Category rows using (1) catalog category/subcategory strings, (2) keyword
 * rules, (3) the "Other / Uncategorised" fallback. Confidence is heuristic.
 */
import type {
  CategoryRow,
  CategorySuggestion,
  CategorySuggestionInput,
} from "@/types/taxonomy";

import { matchKeywordRule, normalizeForMatch } from "./category-keywords";
import { slugify } from "./category-tree";

export const SUGGESTION_CONFIDENCE = {
  catalogExact: 0.95,
  keywordName: 0.75,
  keywordCatalog: 0.7,
  keywordDomain: 0.6,
  fallback: 0.2,
  none: 0,
} as const;

export const FALLBACK_CATEGORY_SLUGS = {
  parent: "other",
  child: "uncategorised",
} as const;

type Active = CategoryRow & { isArchived: false };

function activeRows(rows: CategoryRow[]): CategoryRow[] {
  return rows.filter((r): r is Active => !r.isArchived);
}

function toSuggestion(
  row: CategoryRow,
  confidence: number,
  reason: string
): CategorySuggestion {
  return { categoryId: row.id, parentId: row.parentId, confidence, reason };
}

function findBySlugOrName(
  rows: CategoryRow[],
  text: string,
  parentId?: string | null
) {
  const slug = slugify(text);
  const norm = normalizeForMatch(text);
  return rows.find(
    (r) =>
      (parentId === undefined || r.parentId === parentId) &&
      (r.slug === slug || normalizeForMatch(r.name) === norm)
  );
}

/** Match catalog "Category" / "Subcategory" strings against the org's rows. */
function matchCatalogStrings(
  rows: CategoryRow[],
  catalogCategory: string | null | undefined
): CategorySuggestion | null {
  if (!catalogCategory) return null;
  const [parentText, childText] = catalogCategory.split(/\s*[>/»]\s*/, 2);
  if (childText) {
    const parent = findBySlugOrName(rows, parentText, null);
    const child = findBySlugOrName(rows, childText, parent?.id ?? undefined);
    if (child)
      return toSuggestion(child, SUGGESTION_CONFIDENCE.catalogExact, "catalog");
  }
  const direct = findBySlugOrName(rows, parentText);
  if (direct) {
    // Prefer a child match; a top-level match is still useful.
    return toSuggestion(
      direct,
      SUGGESTION_CONFIDENCE.catalogExact - (direct.parentId ? 0 : 0.15),
      "catalog"
    );
  }
  return null;
}

function matchKeywords(
  rows: CategoryRow[],
  text: string | null | undefined,
  confidence: number,
  reason: string
): CategorySuggestion | null {
  const match = matchKeywordRule(text);
  if (!match) return null;
  const parent = rows.find(
    (r) => r.parentId === null && r.slug === match.rule.parentSlug
  );
  const child = rows.find(
    (r) =>
      r.slug === match.rule.slug &&
      (parent ? r.parentId === parent.id : r.parentId !== null)
  );
  const target = child ?? parent;
  if (!target) return null;
  return toSuggestion(
    target,
    child ? confidence : confidence - 0.15,
    `${reason}:${match.keyword}`
  );
}

/**
 * Suggests a category for a service. `rows` are the organisation's categories
 * (archived rows are ignored).
 */
export function suggestCategoryFromRows(
  input: CategorySuggestionInput,
  rows: CategoryRow[]
): CategorySuggestion {
  const active = activeRows(rows);
  const result =
    matchCatalogStrings(active, input.catalogCategory) ??
    matchKeywords(
      active,
      input.serviceName,
      SUGGESTION_CONFIDENCE.keywordName,
      "keyword:name"
    ) ??
    matchKeywords(
      active,
      input.catalogCategory,
      SUGGESTION_CONFIDENCE.keywordCatalog,
      "keyword:catalog"
    ) ??
    matchKeywords(
      active,
      input.vendorDomain,
      SUGGESTION_CONFIDENCE.keywordDomain,
      "keyword:domain"
    );
  if (result) return result;

  const fallbackParent = active.find(
    (r) => r.parentId === null && r.slug === FALLBACK_CATEGORY_SLUGS.parent
  );
  const fallback =
    active.find(
      (r) =>
        r.slug === FALLBACK_CATEGORY_SLUGS.child &&
        r.parentId === (fallbackParent?.id ?? r.parentId)
    ) ?? fallbackParent;
  if (fallback)
    return toSuggestion(fallback, SUGGESTION_CONFIDENCE.fallback, "fallback");
  return {
    categoryId: null,
    parentId: null,
    confidence: SUGGESTION_CONFIDENCE.none,
    reason: "no-match",
  };
}
