// src/actions/cost-analytics-scope.ts

import { inFilter, mergeLegacyValue } from "@/lib/filters/multi-value";
import type { CostAnalyticsFilters } from "@/types/cost-analytics";

/**
 * Effective report scope. `teamIds` / `userIds` are multi-value filters
 * (empty = all); the singular keys are accepted for older callers.
 */
export interface ReportScope {
  teamIds?: string[];
  userIds?: string[];
  /** @deprecated use `teamIds` */
  teamId?: string;
  /** @deprecated use `userIds` */
  userId?: string;
  enforceTeamId?: string;
}

/** Team / user lists requested by a report filter (single + list merged). */
export function requestedTeamIds(
  filters: Pick<CostAnalyticsFilters, "teamId" | "teamIds">
): string[] | undefined {
  return mergeLegacyValue(filters.teamIds, filters.teamId);
}

export function requestedUserIds(
  filters: Pick<CostAnalyticsFilters, "userId" | "userIds">
): string[] | undefined {
  return mergeLegacyValue(filters.userIds, filters.userId);
}

/**
 * Viewers holding `subscriptions:read_all` (`canReadAll`, see
 * `withReportAccess`) get the requested teams / users. Everyone else is pinned
 * to their own team (users inside it may still be narrowed), or to themselves
 * when they have no team.
 */
export function resolveReportScope(
  filters: CostAnalyticsFilters,
  sessionUser: {
    id: string;
    role?: string | null;
    teamId?: string | null;
    canReadAll?: boolean;
  }
): ReportScope {
  const isRestricted = sessionUser.canReadAll !== true;
  const memberTeamId = sessionUser.teamId ?? undefined;
  const userIds = requestedUserIds(filters);

  if (!isRestricted) {
    return { teamIds: requestedTeamIds(filters), userIds };
  }

  if (!memberTeamId) {
    return {
      userIds: [sessionUser.id],
      enforceTeamId: undefined,
    };
  }

  return {
    teamIds: [memberTeamId],
    userIds,
    enforceTeamId: memberTeamId,
  };
}

function scopeTeams(scope: ReportScope) {
  return inFilter(mergeLegacyValue(scope.teamIds, scope.teamId));
}

function scopeUsers(scope: ReportScope) {
  return inFilter(mergeLegacyValue(scope.userIds, scope.userId));
}

export function applyPaymentRecordScope(
  where: Record<string, unknown>,
  scope: ReportScope
) {
  const users = scopeUsers(scope);
  if (users) {
    where.userId = users;
    if (scope.enforceTeamId) {
      where.user = { teamId: scope.enforceTeamId };
    }
    return;
  }

  const teams = scopeTeams(scope);
  if (teams) {
    where.OR = [{ teamId: teams }, { user: { teamId: teams } }];
  }
}

export function applyCardTransactionScope(
  where: Record<string, unknown>,
  scope: ReportScope
) {
  const users = scopeUsers(scope);
  if (users) {
    where.corporateCard = scope.enforceTeamId
      ? {
          assignedUserId: users,
          assignedUser: { teamId: scope.enforceTeamId },
        }
      : { assignedUserId: users };
    return;
  }

  const teams = scopeTeams(scope);
  if (teams) {
    where.corporateCard = {
      OR: [{ teamId: teams }, { assignedUser: { teamId: teams } }],
    };
  }
}
