// src/lib/services/discovery/scope-where.ts
/**
 * Prisma `where` fragments shared by discovery actions: workspace/personal
 * scope and row-level visibility for users without `subscriptions:read_all`.
 */
import type { WorkspaceScope } from "@/types/discovery";
import type { Prisma } from "@prisma/client";

export interface ViewerContext {
  userId: string;
  teamId: string | null;
  canReadAll: boolean;
}

export function scopeWhere(
  scope: WorkspaceScope,
  userId: string
): Prisma.SubscriptionWhereInput {
  if (scope === "personal") return { isPersonal: true, ownerId: userId };
  if (scope === "workspace") return { isPersonal: false };
  return {};
}

/** Own, team or assigned subscriptions when the viewer cannot read everything. */
export function visibilityWhere(
  viewer: ViewerContext
): Prisma.SubscriptionWhereInput {
  if (viewer.canReadAll) return {};
  const clauses: Prisma.SubscriptionWhereInput[] = [
    { ownerId: viewer.userId },
    { assignedUsers: { some: { userId: viewer.userId } } },
  ];
  if (viewer.teamId) clauses.push({ teamId: viewer.teamId });
  return { OR: clauses };
}

export function discoveryWhere(
  organizationId: string,
  scope: WorkspaceScope,
  viewer: ViewerContext,
  extra: Prisma.SubscriptionWhereInput = {}
): Prisma.SubscriptionWhereInput {
  return {
    AND: [
      { organizationId },
      scopeWhere(scope, viewer.userId),
      visibilityWhere(viewer),
      extra,
    ],
  };
}
