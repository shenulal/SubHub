// src/actions/discovery/saved-views.ts
"use server";

/**
 * Saved views (9.2): named filter + sort presets for the subscription list.
 * Private views belong to the user; shared views are visible to the whole
 * organisation and require `subscriptions:read_all` to create or edit.
 * The per-user default view id lives in `User.preferences.defaultViews[entity]`.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { isForbiddenError, requirePermission } from "@/lib/rbac/service";
import {
  AUDIT_CREATE_SAVED_VIEW,
  AUDIT_DELETE_SAVED_VIEW,
  AUDIT_SET_DEFAULT_SAVED_VIEW,
  AUDIT_UPDATE_SAVED_VIEW,
} from "@/lib/services/discovery/audit-actions";
import {
  savedViewInputSchema,
  savedViewUpdateSchema,
  subscriptionFilterSchema,
  subscriptionSortSchema,
} from "@/lib/validations/discovery";
import type { ActionState } from "@/types";
import type {
  SavedViewDto,
  SubscriptionListFilter,
  SubscriptionListSort,
} from "@/types/discovery";
import type { Prisma, SavedView } from "@prisma/client";
import { revalidatePath } from "next/cache";

const LIST_PATH = "/subscriptions";
const SHARED_PERMISSION = "subscriptions:read_all" as const;

type Preferences = Record<string, unknown> & {
  defaultViews?: Record<string, string>;
};

function toPreferences(raw: unknown): Preferences {
  return raw && typeof raw === "object" ? (raw as Preferences) : {};
}

function parseFilters(raw: unknown): SubscriptionListFilter {
  const parsed = subscriptionFilterSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

function parseSort(raw: unknown): SubscriptionListSort | null {
  const parsed = subscriptionSortSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function toDto(
  row: SavedView,
  userId: string,
  defaultId: string | undefined
): SavedViewDto {
  return {
    id: row.id,
    entity: row.entity,
    name: row.name,
    filters: parseFilters(row.filters),
    sort: parseSort(row.sort),
    isShared: row.isShared,
    isOwner: row.userId === userId,
    isDefault: row.id === defaultId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function fail(error: unknown, fallback: string): ActionState<never> {
  if (isForbiddenError(error)) return { success: false, error: error.message };
  logger.error({ err: error }, `[discovery] ${fallback}`);
  return { success: false, error: fallback };
}

async function readDefaultViewId(
  userId: string,
  entity: string
): Promise<string | undefined> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  return toPreferences(user?.preferences).defaultViews?.[entity];
}

async function audit(
  action: string,
  entityId: string,
  userId: string,
  organizationId: string,
  metadata: Prisma.InputJsonValue
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action,
      entityType: "SavedView",
      entityId,
      userId,
      organizationId,
      metadata,
    },
  });
}

/** Own views + shared views of the organisation for one entity. */
export const listSavedViews = withLogging(
  "listSavedViews",
  async (entity = "subscriptions"): Promise<ActionState<SavedViewDto[]>> => {
    try {
      const { userId, organizationId } =
        await requirePermission("subscriptions:read");
      const [rows, defaultId] = await Promise.all([
        prisma.savedView.findMany({
          where: {
            organizationId,
            entity,
            OR: [{ userId }, { isShared: true }],
          },
          orderBy: [{ isShared: "asc" }, { name: "asc" }],
        }),
        readDefaultViewId(userId, entity),
      ]);
      return {
        success: true,
        data: rows.map((r) => toDto(r, userId, defaultId)),
      };
    } catch (error) {
      return fail(error, "Could not load saved views");
    }
  }
);

export const createSavedView = withLogging(
  "createSavedView",
  async (input: unknown): Promise<ActionState<SavedViewDto>> => {
    const parsed = savedViewInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid saved view",
        errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    try {
      const { userId, organizationId } =
        await requirePermission("subscriptions:read");
      if (parsed.data.isShared) await requirePermission(SHARED_PERMISSION);
      const { entity, name, filters, sort, isShared } = parsed.data;
      const row = await prisma.savedView.upsert({
        where: { userId_entity_name: { userId, entity, name } },
        create: {
          organizationId,
          userId,
          entity,
          name,
          filters: filters as Prisma.InputJsonValue,
          sort: (sort ?? undefined) as Prisma.InputJsonValue | undefined,
          isShared,
        },
        update: {
          filters: filters as Prisma.InputJsonValue,
          sort: (sort ?? undefined) as Prisma.InputJsonValue | undefined,
          isShared,
        },
      });
      await audit(AUDIT_CREATE_SAVED_VIEW, row.id, userId, organizationId, {
        name,
        entity,
        isShared,
      });
      revalidatePath(LIST_PATH);
      return { success: true, data: toDto(row, userId, undefined) };
    } catch (error) {
      return fail(error, "Could not save view");
    }
  }
);

export const updateSavedView = withLogging(
  "updateSavedView",
  async (input: unknown): Promise<ActionState<SavedViewDto>> => {
    const parsed = savedViewUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid saved view" };
    }
    try {
      const { userId, organizationId } =
        await requirePermission("subscriptions:read");
      const existing = await prisma.savedView.findFirst({
        where: { id: parsed.data.id, organizationId },
      });
      if (!existing) return { success: false, error: "View not found" };
      const editingShared = existing.isShared || parsed.data.isShared;
      if (editingShared) await requirePermission(SHARED_PERMISSION);
      if (existing.userId !== userId && !editingShared) {
        return { success: false, error: "You can only edit your own views" };
      }
      const { name, filters, sort, isShared } = parsed.data;
      const row = await prisma.savedView.update({
        where: { id: existing.id },
        data: {
          ...(name !== undefined && { name }),
          ...(filters !== undefined && {
            filters: filters as Prisma.InputJsonValue,
          }),
          ...(sort !== undefined && {
            sort: (sort ?? undefined) as Prisma.InputJsonValue | undefined,
          }),
          ...(isShared !== undefined && { isShared }),
        },
      });
      await audit(AUDIT_UPDATE_SAVED_VIEW, row.id, userId, organizationId, {
        name: row.name,
        isShared: row.isShared,
      });
      revalidatePath(LIST_PATH);
      const defaultId = await readDefaultViewId(userId, row.entity);
      return { success: true, data: toDto(row, userId, defaultId) };
    } catch (error) {
      return fail(error, "Could not update view");
    }
  }
);

export const deleteSavedView = withLogging(
  "deleteSavedView",
  async (id: string): Promise<ActionState> => {
    try {
      const { userId, organizationId } =
        await requirePermission("subscriptions:read");
      const existing = await prisma.savedView.findFirst({
        where: { id, organizationId },
      });
      if (!existing) return { success: false, error: "View not found" };
      if (existing.isShared) await requirePermission(SHARED_PERMISSION);
      else if (existing.userId !== userId) {
        return { success: false, error: "You can only delete your own views" };
      }
      await prisma.savedView.delete({ where: { id } });
      await audit(AUDIT_DELETE_SAVED_VIEW, id, userId, organizationId, {
        name: existing.name,
      });
      revalidatePath(LIST_PATH);
      return { success: true };
    } catch (error) {
      return fail(error, "Could not delete view");
    }
  }
);

/** Set (or clear with `null`) the user's default view for an entity. */
export const setDefaultView = withLogging(
  "setDefaultView",
  async (id: string | null, entity = "subscriptions"): Promise<ActionState> => {
    try {
      const { userId, organizationId } =
        await requirePermission("subscriptions:read");
      if (id) {
        const view = await prisma.savedView.findFirst({
          where: { id, organizationId, OR: [{ userId }, { isShared: true }] },
          select: { id: true },
        });
        if (!view) return { success: false, error: "View not found" };
      }
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
      });
      const prefs = toPreferences(user?.preferences);
      const defaultViews = { ...(prefs.defaultViews ?? {}) };
      if (id) defaultViews[entity] = id;
      else delete defaultViews[entity];
      await prisma.user.update({
        where: { id: userId },
        data: { preferences: { ...prefs, defaultViews } },
      });
      await audit(
        AUDIT_SET_DEFAULT_SAVED_VIEW,
        id ?? entity,
        userId,
        organizationId,
        {
          entity,
          viewId: id,
        }
      );
      revalidatePath(LIST_PATH);
      return { success: true };
    } catch (error) {
      return fail(error, "Could not set default view");
    }
  }
);
