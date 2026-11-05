// src/actions/subscriptions/subscription-crud-write.relations.ts
/**
 * Relation side-effects for subscription writes: app resolution (find-or-create),
 * team/user assignments, tags and custom-field values.
 */
import { prisma } from "@/lib/db";

import { ensureTags, validateCustomFieldValues } from "./taxonomy-adapter";

export interface ResolvedApp {
  id: string;
  name: string;
}

export interface AppInput {
  appId?: string | null;
  appName?: string | null;
  catalogId?: string | null;
  appWebsite?: string | null;
  appLogoUrl?: string | null;
  categoryId?: string | null;
}

/**
 * Resolve the App row for a new subscription: an explicit id inside the
 * organisation, or find-or-create by vendor name (unique per organisation).
 */
export async function resolveApp(
  organizationId: string,
  input: AppInput
): Promise<ResolvedApp | null> {
  if (input.appId) {
    const app = await prisma.app.findFirst({
      where: { id: input.appId, organizationId },
      select: { id: true, name: true },
    });
    return app;
  }
  const name = input.appName?.trim();
  if (!name) return null;

  const existing = await prisma.app.findFirst({
    where: { organizationId, name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (existing) return existing;

  return prisma.app.create({
    data: {
      organizationId,
      name,
      source: "MANUAL",
      catalogId: input.catalogId || null,
      customWebsite: input.appWebsite || null,
      customLogoUrl: input.appLogoUrl || null,
      categoryId: input.categoryId || null,
    },
    select: { id: true, name: true },
  });
}

export interface AssignmentInput {
  teamId: string | null;
  teamIds: string[];
  assignedUserIds: string[];
}

export interface AssignmentPlan {
  teamIds: string[];
  userIds: string[];
  /** Error message when users are not valid organisation members. */
  error?: string;
}

/**
 * Validate assignment ids and make sure the App is linked to every team that
 * will own or use it (SMP-134 behaviour preserved).
 */
export async function prepareAssignments(
  organizationId: string,
  appId: string,
  actorId: string,
  input: AssignmentInput
): Promise<AssignmentPlan> {
  const teamIds =
    input.teamIds.length > 0
      ? input.teamIds
      : input.teamId
        ? [input.teamId]
        : [];

  const userIds = Array.from(new Set(input.assignedUserIds));
  const userTeamIds: string[] = [];
  if (userIds.length > 0) {
    const validUsers = await prisma.user.findMany({
      where: { id: { in: userIds }, organizationId },
      select: { id: true, teamId: true },
    });
    if (validUsers.length !== userIds.length) {
      return {
        teamIds,
        userIds,
        error: "One or more users are invalid",
      };
    }
    for (const user of validUsers) {
      if (user.teamId) userTeamIds.push(user.teamId);
    }
  }

  const linkTeamIds = Array.from(new Set([...teamIds, ...userTeamIds]));
  if (linkTeamIds.length > 0) {
    await prisma.appTeam.createMany({
      data: linkTeamIds.map((teamId) => ({
        appId,
        teamId,
        assignedBy: actorId,
      })),
      skipDuplicates: true,
    });
  }
  return { teamIds, userIds };
}

/** Replace team/user assignment rows (delete-recreate). */
export async function syncAssignments(
  subscriptionId: string,
  actorId: string,
  plan: AssignmentPlan,
  mode: "create" | "update"
): Promise<void> {
  if (mode === "update") {
    await prisma.subscriptionTeam.deleteMany({ where: { subscriptionId } });
    await prisma.subscriptionUser.deleteMany({ where: { subscriptionId } });
  }
  if (plan.teamIds.length > 0) {
    await prisma.subscriptionTeam.createMany({
      data: plan.teamIds.map((teamId) => ({
        subscriptionId,
        teamId,
        assignedBy: actorId,
      })),
      skipDuplicates: true,
    });
  }
  if (plan.userIds.length > 0) {
    await prisma.subscriptionUser.createMany({
      data: plan.userIds.map((userId) => ({
        subscriptionId,
        userId,
        assignedBy: actorId,
      })),
      skipDuplicates: true,
    });
  }
}

/** Replace the subscription's tag set with the given tag names. */
export async function syncTags(
  subscriptionId: string,
  tagNames: string[],
  mode: "create" | "update"
): Promise<void> {
  if (mode === "update") {
    await prisma.subscriptionTag.deleteMany({ where: { subscriptionId } });
  }
  if (tagNames.length === 0) return;
  const tags = await ensureTags(tagNames);
  if (tags.length === 0) return;
  await prisma.subscriptionTag.createMany({
    data: tags.map((tag) => ({ subscriptionId, tagId: tag.id })),
    skipDuplicates: true,
  });
}

export interface CustomFieldPlan {
  rows: Array<{ fieldId: string; value: string }>;
  errors?: Record<string, string[]>;
}

/**
 * Validate custom-field values (via taxonomy) and map keys/ids to definition ids.
 * Blank values are dropped so required-field checks come from the validator.
 */
export async function prepareCustomFields(
  organizationId: string,
  values: Record<string, string>
): Promise<CustomFieldPlan> {
  const validation = await validateCustomFieldValues(values);
  if (!validation.success) {
    return {
      rows: [],
      errors: validation.errors ?? { customFields: ["Invalid"] },
    };
  }
  const entries = Object.entries(values).filter(([, v]) => v.trim() !== "");
  if (entries.length === 0) return { rows: [] };

  const definitions = await prisma.customFieldDefinition.findMany({
    where: { organizationId, isArchived: false },
    select: { id: true, key: true },
  });
  const byIdOrKey = new Map<string, string>();
  for (const def of definitions) {
    byIdOrKey.set(def.id, def.id);
    byIdOrKey.set(def.key, def.id);
  }
  const rows = entries.flatMap(([keyOrId, value]) => {
    const fieldId = byIdOrKey.get(keyOrId);
    return fieldId ? [{ fieldId, value: value.trim() }] : [];
  });
  return { rows };
}

/** Replace custom-field values (delete-recreate keeps the unique constraint simple). */
export async function syncCustomFields(
  subscriptionId: string,
  plan: CustomFieldPlan,
  mode: "create" | "update"
): Promise<void> {
  if (mode === "update") {
    await prisma.customFieldValue.deleteMany({ where: { subscriptionId } });
  }
  if (plan.rows.length === 0) return;
  await prisma.customFieldValue.createMany({
    data: plan.rows.map((row) => ({ subscriptionId, ...row })),
    skipDuplicates: true,
  });
}
