// src/actions/taxonomy/categories.ts
/**
 * Category server actions — two-level hierarchy (parent → child) per organisation.
 * Reads need `categories:read`, writes need `categories:manage`.
 */
"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import {
  buildCategoryTree,
  nextUniqueSlug,
  slugify,
  toNumberOrNull,
} from "@/lib/services/taxonomy/category-tree";
import {
  createCategorySchema,
  reorderCategoriesSchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type ReorderCategoriesInput,
  type UpdateCategoryInput,
} from "@/lib/validations/taxonomy";
import type { ActionState } from "@/types";
import type { CategoryNode, CategoryPath, CategoryRow } from "@/types/taxonomy";

import {
  TAXONOMY_PATHS,
  toActionError,
  validationFailure,
  writeAudit,
} from "./_shared";

const ENTITY = "Category";

type DbCategory = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  icon: string | null;
  color: string | null;
  isArchived: boolean;
  isDefault: boolean;
  sortOrder: number;
  budgetMonthly: { toNumber(): number } | null;
  _count?: { subscriptions: number };
};

function toRow(c: DbCategory): CategoryRow {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parentId,
    icon: c.icon,
    color: c.color,
    isArchived: c.isArchived,
    isDefault: c.isDefault,
    sortOrder: c.sortOrder,
    budgetMonthly: toNumberOrNull(c.budgetMonthly),
    usageCount: c._count?.subscriptions,
  };
}

function revalidate() {
  revalidatePath(TAXONOMY_PATHS.settings);
  revalidatePath(TAXONOMY_PATHS.subscriptions);
}

async function findOwned(id: string, organizationId: string) {
  return prisma.category.findFirst({ where: { id, organizationId } });
}

// ─── Reads ───────────────────────────────────────────────────────────

export async function getCategoryTree(
  options: { includeArchived?: boolean } = {}
): Promise<CategoryNode[]> {
  try {
    const { organizationId } = await requirePermission("categories:read");
    const rows = await prisma.category.findMany({
      where: {
        organizationId,
        ...(options.includeArchived ? {} : { isArchived: false }),
      },
      include: { _count: { select: { subscriptions: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return buildCategoryTree(rows.map(toRow));
  } catch (error) {
    toActionError(error, "getCategoryTree");
    return [];
  }
}

export async function getCategoryPath(
  categoryId: string
): Promise<CategoryPath | null> {
  try {
    const { organizationId } = await requirePermission("categories:read");
    const row = await prisma.category.findFirst({
      where: { id: categoryId, organizationId },
      select: {
        id: true,
        name: true,
        parent: { select: { id: true, name: true } },
      },
    });
    if (!row) return null;
    return {
      parent: row.parent ?? null,
      child: { id: row.id, name: row.name },
    };
  } catch (error) {
    toActionError(error, "getCategoryPath");
    return null;
  }
}

// ─── Writes ──────────────────────────────────────────────────────────

async function _createCategory(
  input: CreateCategoryInput
): Promise<ActionState<CategoryRow>> {
  try {
    const { organizationId, userId } =
      await requirePermission("categories:manage");
    const parsed = createCategorySchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const data = parsed.data;
    const parentId = data.parentId ?? null;

    if (parentId) {
      const parent = await findOwned(parentId, organizationId);
      if (!parent)
        return { success: false, error: "Parent category not found" };
      if (parent.parentId)
        return {
          success: false,
          error: "Categories can only be two levels deep",
        };
    }

    const siblings = await prisma.category.findMany({
      where: { organizationId, parentId },
      select: { slug: true, name: true, sortOrder: true },
    });
    if (
      siblings.some((s) => s.name.toLowerCase() === data.name.toLowerCase())
    ) {
      return {
        success: false,
        error: "A category with this name already exists here",
      };
    }
    const slug = nextUniqueSlug(
      slugify(data.name),
      siblings.map((s) => s.slug)
    );
    const sortOrder =
      siblings.reduce((max, s) => Math.max(max, s.sortOrder), -1) + 1;

    const created = await prisma.category.create({
      data: {
        organizationId,
        parentId,
        name: data.name,
        slug,
        icon: data.icon ?? null,
        color: data.color ?? null,
        budgetMonthly: data.budgetMonthly ?? null,
        sortOrder,
      },
    });
    await writeAudit({
      organizationId,
      userId,
      action: "CREATE_CATEGORY",
      entityType: ENTITY,
      entityId: created.id,
      changes: { name: created.name, parentId },
    });
    revalidate();
    return { success: true, data: toRow(created), message: "Category created" };
  } catch (error) {
    return toActionError(error, "createCategory");
  }
}
export const createCategory = withLogging("createCategory", _createCategory);

async function _updateCategory(
  id: string,
  input: UpdateCategoryInput
): Promise<ActionState<CategoryRow>> {
  try {
    const { organizationId, userId } =
      await requirePermission("categories:manage");
    const parsed = updateCategorySchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const data = parsed.data;

    const existing = await findOwned(id, organizationId);
    if (!existing) return { success: false, error: "Category not found" };

    let slug = existing.slug;
    if (data.name && data.name.toLowerCase() !== existing.name.toLowerCase()) {
      const siblings = await prisma.category.findMany({
        where: { organizationId, parentId: existing.parentId, id: { not: id } },
        select: { slug: true, name: true },
      });
      if (
        siblings.some((s) => s.name.toLowerCase() === data.name!.toLowerCase())
      ) {
        return {
          success: false,
          error: "A category with this name already exists here",
        };
      }
      // Default categories keep their slug so keyword rules keep matching.
      if (!existing.isDefault)
        slug = nextUniqueSlug(
          slugify(data.name),
          siblings.map((s) => s.slug)
        );
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name, slug }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.budgetMonthly !== undefined && {
          budgetMonthly: data.budgetMonthly,
        }),
      },
    });
    await writeAudit({
      organizationId,
      userId,
      action: "UPDATE_CATEGORY",
      entityType: ENTITY,
      entityId: id,
      changes: { before: { name: existing.name }, after: { ...data } },
    });
    revalidate();
    return { success: true, data: toRow(updated), message: "Category updated" };
  } catch (error) {
    return toActionError(error, "updateCategory");
  }
}
export const updateCategory = withLogging("updateCategory", _updateCategory);

async function setArchived(
  id: string,
  isArchived: boolean,
  context: "archiveCategory" | "restoreCategory"
): Promise<ActionState<{ affected: number }>> {
  try {
    const { organizationId, userId } =
      await requirePermission("categories:manage");
    const existing = await findOwned(id, organizationId);
    if (!existing) return { success: false, error: "Category not found" };

    const affected = await prisma.$transaction(async (tx) => {
      // Archiving a parent archives its children; restoring a child restores its parent.
      const ids = [id];
      if (isArchived && !existing.parentId) {
        const children = await tx.category.findMany({
          where: { parentId: id, organizationId },
          select: { id: true },
        });
        ids.push(...children.map((c) => c.id));
      }
      if (!isArchived && existing.parentId) ids.push(existing.parentId);
      const result = await tx.category.updateMany({
        where: { id: { in: ids }, organizationId },
        data: { isArchived },
      });
      await writeAudit(
        {
          organizationId,
          userId,
          action: isArchived ? "ARCHIVE_CATEGORY" : "RESTORE_CATEGORY",
          entityType: ENTITY,
          entityId: id,
          changes: { ids },
        },
        tx
      );
      return result.count;
    });
    revalidate();
    return {
      success: true,
      data: { affected },
      message: isArchived ? "Category archived" : "Category restored",
    };
  } catch (error) {
    return toActionError(error, context);
  }
}

export const archiveCategory = withLogging(
  "archiveCategory",
  async (id: string) => setArchived(id, true, "archiveCategory")
);
export const restoreCategory = withLogging(
  "restoreCategory",
  async (id: string) => setArchived(id, false, "restoreCategory")
);

async function _reorderCategories(
  input: ReorderCategoriesInput
): Promise<ActionState> {
  try {
    const { organizationId, userId } =
      await requirePermission("categories:manage");
    const parsed = reorderCategoriesSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const { parentId, orderedIds } = parsed.data;

    const owned = await prisma.category.findMany({
      where: { organizationId, parentId, id: { in: orderedIds } },
      select: { id: true },
    });
    if (owned.length !== new Set(orderedIds).size) {
      return {
        success: false,
        error: "Some categories do not belong to this level",
      };
    }

    await prisma.$transaction([
      ...orderedIds.map((id, sortOrder) =>
        prisma.category.update({ where: { id }, data: { sortOrder } })
      ),
      prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          action: "REORDER_CATEGORIES",
          entityType: ENTITY,
          entityId: parentId,
          changes: { orderedIds },
        },
      }),
    ]);
    revalidate();
    return { success: true, message: "Order saved" };
  } catch (error) {
    logger.debug({ err: error }, "reorderCategories");
    return toActionError(error, "reorderCategories");
  }
}
export const reorderCategories = withLogging(
  "reorderCategories",
  _reorderCategories
);
