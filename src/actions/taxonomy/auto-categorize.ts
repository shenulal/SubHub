// src/actions/taxonomy/auto-categorize.ts
/**
 * Auto-categorisation: maps a service to one of the organisation's categories
 * using the catalog's category/subcategory strings and keyword rules.
 */
"use server";

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/service";
import { suggestCategoryFromRows } from "@/lib/services/taxonomy/category-matcher";
import { toNumberOrNull } from "@/lib/services/taxonomy/category-tree";
import type {
  CategoryRow,
  CategorySuggestion,
  CategorySuggestionInput,
} from "@/types/taxonomy";

import { toActionError } from "./_shared";

const NO_MATCH: CategorySuggestion = {
  categoryId: null,
  parentId: null,
  confidence: 0,
  reason: "no-match",
};

/** When the caller did not pass a catalog category, look the service up in the catalog. */
async function catalogCategoryFor(serviceName: string): Promise<string | null> {
  const name = serviceName.trim();
  if (!name) return null;
  const item = await prisma.saaSCatalog.findFirst({
    where: {
      isActive: true,
      OR: [
        { name: { equals: name, mode: "insensitive" } },
        { aliases: { has: name } },
      ],
    },
    select: { category: true, subcategory: true },
  });
  if (!item) return null;
  return item.subcategory
    ? `${item.category} > ${item.subcategory}`
    : item.category;
}

export async function suggestCategory(
  input: CategorySuggestionInput
): Promise<CategorySuggestion> {
  try {
    const { organizationId } = await requirePermission("categories:read");
    const catalogCategory =
      input.catalogCategory ?? (await catalogCategoryFor(input.serviceName));
    const categories = await prisma.category.findMany({
      where: { organizationId, isArchived: false },
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        icon: true,
        color: true,
        isArchived: true,
        isDefault: true,
        sortOrder: true,
        budgetMonthly: true,
      },
    });
    const rows: CategoryRow[] = categories.map((c) => ({
      ...c,
      budgetMonthly: toNumberOrNull(c.budgetMonthly),
    }));
    return suggestCategoryFromRows({ ...input, catalogCategory }, rows);
  } catch (error) {
    toActionError(error, "suggestCategory");
    return NO_MATCH;
  }
}
