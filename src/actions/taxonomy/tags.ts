// src/actions/taxonomy/tags.ts
/**
 * Tag server actions. `tags:read` for lookups, `tags:create` for find-or-create
 * while editing a subscription, `tags:manage` for rename / merge / delete / colour.
 */
"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import {
  mergeTagsSchema,
  tagColorSchema,
  tagNameSchema,
} from "@/lib/validations/taxonomy";
import type { ActionState } from "@/types";
import type { TagDto } from "@/types/taxonomy";

import {
  TAXONOMY_PATHS,
  toActionError,
  validationFailure,
  writeAudit,
} from "./_shared";

const ENTITY = "Tag";
const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 50;

type DbTag = {
  id: string;
  name: string;
  color: string | null;
  _count?: { subscriptions: number };
};

function toDto(t: DbTag): TagDto {
  return {
    id: t.id,
    name: t.name,
    color: t.color,
    usageCount: t._count?.subscriptions,
  };
}

function revalidate() {
  revalidatePath(TAXONOMY_PATHS.settings);
  revalidatePath(TAXONOMY_PATHS.subscriptions);
}

/** Trim, drop empties, de-duplicate case-insensitively while keeping first spelling. */
function normalizeNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

// ─── Reads ───────────────────────────────────────────────────────────

export async function listTags(): Promise<TagDto[]> {
  try {
    const { organizationId } = await requirePermission("tags:read");
    const tags = await prisma.tag.findMany({
      where: { organizationId },
      include: { _count: { select: { subscriptions: true } } },
      orderBy: { name: "asc" },
    });
    return tags.map(toDto);
  } catch (error) {
    toActionError(error, "listTags");
    return [];
  }
}

export async function searchTags(
  query: string,
  limit = DEFAULT_SEARCH_LIMIT
): Promise<TagDto[]> {
  try {
    const { organizationId } = await requirePermission("tags:read");
    const q = query.trim();
    const take = Math.min(Math.max(1, limit), MAX_SEARCH_LIMIT);
    const tags = await prisma.tag.findMany({
      where: {
        organizationId,
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      include: { _count: { select: { subscriptions: true } } },
      orderBy: { name: "asc" },
      take,
    });
    return tags.map(toDto);
  } catch (error) {
    toActionError(error, "searchTags");
    return [];
  }
}

// ─── Writes ──────────────────────────────────────────────────────────

/** Find-or-create by name (case-insensitive). Returns tags in input order. */
export async function ensureTags(names: string[]): Promise<TagDto[]> {
  const wanted = normalizeNames(names);
  if (wanted.length === 0) return [];
  const { organizationId, userId } = await requirePermission("tags:create");

  for (const name of wanted) {
    const parsed = tagNameSchema.safeParse(name);
    if (!parsed.success)
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid tag name");
  }

  const existing = await prisma.tag.findMany({
    where: {
      organizationId,
      OR: wanted.map((name) => ({
        name: { equals: name, mode: "insensitive" },
      })),
    },
  });
  const byKey = new Map(existing.map((t) => [t.name.toLowerCase(), t]));
  const missing = wanted.filter((n) => !byKey.has(n.toLowerCase()));

  for (const name of missing) {
    const created = await prisma.tag.create({ data: { organizationId, name } });
    byKey.set(name.toLowerCase(), created);
    await writeAudit({
      organizationId,
      userId,
      action: "CREATE_TAG",
      entityType: ENTITY,
      entityId: created.id,
      changes: { name },
    });
  }
  if (missing.length > 0) revalidate();
  return wanted.map((n) => toDto(byKey.get(n.toLowerCase())!));
}

async function _renameTag(
  id: string,
  name: string
): Promise<ActionState<TagDto>> {
  try {
    const { organizationId, userId } = await requirePermission("tags:manage");
    const parsed = tagNameSchema.safeParse(name);
    if (!parsed.success) return validationFailure(parsed.error);
    const tag = await prisma.tag.findFirst({ where: { id, organizationId } });
    if (!tag) return { success: false, error: "Tag not found" };
    const clash = await prisma.tag.findFirst({
      where: {
        organizationId,
        id: { not: id },
        name: { equals: parsed.data, mode: "insensitive" },
      },
    });
    if (clash)
      return { success: false, error: "A tag with this name already exists" };
    const updated = await prisma.tag.update({
      where: { id },
      data: { name: parsed.data },
    });
    await writeAudit({
      organizationId,
      userId,
      action: "RENAME_TAG",
      entityType: ENTITY,
      entityId: id,
      changes: { from: tag.name, to: parsed.data },
    });
    revalidate();
    return { success: true, data: toDto(updated), message: "Tag renamed" };
  } catch (error) {
    return toActionError(error, "renameTag");
  }
}
export const renameTag = withLogging("renameTag", _renameTag);

async function _setTagColor(
  id: string,
  color: string | null
): Promise<ActionState<TagDto>> {
  try {
    const { organizationId, userId } = await requirePermission("tags:manage");
    const parsed = tagColorSchema.safeParse(color);
    if (!parsed.success) return validationFailure(parsed.error);
    const tag = await prisma.tag.findFirst({ where: { id, organizationId } });
    if (!tag) return { success: false, error: "Tag not found" };
    const updated = await prisma.tag.update({
      where: { id },
      data: { color: parsed.data },
    });
    await writeAudit({
      organizationId,
      userId,
      action: "UPDATE_TAG",
      entityType: ENTITY,
      entityId: id,
      changes: { color: parsed.data },
    });
    revalidate();
    return { success: true, data: toDto(updated) };
  } catch (error) {
    return toActionError(error, "setTagColor");
  }
}
export const setTagColor = withLogging("setTagColor", _setTagColor);

/** Moves every subscription link from the source tags to the target, then deletes the sources. */
async function _mergeTags(
  sourceIds: string[],
  targetId: string
): Promise<ActionState<{ moved: number }>> {
  try {
    const { organizationId, userId } = await requirePermission("tags:manage");
    const parsed = mergeTagsSchema.safeParse({ sourceIds, targetId });
    if (!parsed.success) return validationFailure(parsed.error);
    const sources = parsed.data.sourceIds.filter((s) => s !== targetId);
    if (sources.length === 0)
      return {
        success: false,
        error: "Select at least one other tag to merge",
      };

    const owned = await prisma.tag.findMany({
      where: { organizationId, id: { in: [...sources, targetId] } },
      select: { id: true },
    });
    if (owned.length !== sources.length + 1)
      return { success: false, error: "Tag not found" };

    const moved = await prisma.$transaction(async (tx) => {
      const links = await tx.subscriptionTag.findMany({
        where: { tagId: { in: sources } },
        select: { subscriptionId: true },
      });
      const subscriptionIds = Array.from(
        new Set(links.map((l) => l.subscriptionId))
      );
      if (subscriptionIds.length > 0) {
        await tx.subscriptionTag.createMany({
          data: subscriptionIds.map((subscriptionId) => ({
            subscriptionId,
            tagId: targetId,
          })),
          skipDuplicates: true,
        });
      }
      await tx.tag.deleteMany({
        where: { id: { in: sources }, organizationId },
      });
      await writeAudit(
        {
          organizationId,
          userId,
          action: "MERGE_TAGS",
          entityType: ENTITY,
          entityId: targetId,
          changes: { sourceIds: sources, subscriptionIds },
        },
        tx
      );
      return subscriptionIds.length;
    });
    revalidate();
    return { success: true, data: { moved }, message: "Tags merged" };
  } catch (error) {
    return toActionError(error, "mergeTags");
  }
}
export const mergeTags = withLogging("mergeTags", _mergeTags);

async function _deleteTag(id: string): Promise<ActionState> {
  try {
    const { organizationId, userId } = await requirePermission("tags:manage");
    const tag = await prisma.tag.findFirst({ where: { id, organizationId } });
    if (!tag) return { success: false, error: "Tag not found" };
    await prisma.tag.delete({ where: { id } });
    await writeAudit({
      organizationId,
      userId,
      action: "DELETE_TAG",
      entityType: ENTITY,
      entityId: id,
      changes: { name: tag.name },
    });
    revalidate();
    return { success: true, message: "Tag deleted" };
  } catch (error) {
    return toActionError(error, "deleteTag");
  }
}
export const deleteTag = withLogging("deleteTag", _deleteTag);
