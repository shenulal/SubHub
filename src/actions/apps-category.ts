// src/actions/apps-category.ts
/**
 * Resolves an app's category from the Category master. `categoryId` is the
 * source of truth; the legacy `App.category` string is kept in sync with the
 * category name so existing filters and reports keep working.
 * Not a server-action module (no "use server").
 */
import { prisma } from "@/lib/db";

export type AppCategoryResolution =
  | { ok: true; categoryId: string | null; category: string | null }
  | { ok: false; message: string };

export async function resolveAppCategory(
  organizationId: string,
  categoryId: string | null | undefined,
  legacyCategory: string | null | undefined
): Promise<AppCategoryResolution> {
  if (!categoryId) {
    return {
      ok: true,
      categoryId: null,
      category: legacyCategory?.trim() || null,
    };
  }
  const category = await prisma.category.findFirst({
    where: { id: categoryId, organizationId, isArchived: false },
    select: { id: true, name: true },
  });
  if (!category) {
    return { ok: false, message: "The selected category is not available" };
  }
  return { ok: true, categoryId: category.id, category: category.name };
}
