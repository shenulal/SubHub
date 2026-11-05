"use client";

// src/components/reports/team-user-filter.tsx
/**
 * Report filter: several teams and several users (empty = all). With teams
 * picked, only their members are offered; otherwise every user is listed,
 * grouped by team. Restricted viewers get a locked team selection.
 */
import { FilterMultiSelect } from "@/components/common/filter-multi-select";
import { Card, CardContent } from "@/components/ui/card";
import type { MultiSelectOption } from "@/components/ui/multi-select";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

export interface TeamFilterOption {
  id: string;
  name: string;
}

export interface UserFilterOption {
  id: string;
  name: string | null;
  email: string;
  teamId: string | null;
  teamName: string | null;
}

interface TeamUserFilterProps {
  teamIds: string[];
  userIds: string[];
  teams: TeamFilterOption[];
  users: UserFilterOption[];
  /** Called with the new teams and the user selection pruned to them. */
  onTeamsChange: (teamIds: string[], userIds: string[]) => void;
  onUsersChange: (userIds: string[]) => void;
  includeAllOption?: boolean;
  teamLocked?: boolean;
}

/** Users offered for the current team selection (all users when none). */
export function usersForTeams(
  users: UserFilterOption[],
  teamIds: string[]
): UserFilterOption[] {
  if (teamIds.length === 0) return users;
  const teams = new Set(teamIds);
  return users.filter((user) => user.teamId && teams.has(user.teamId));
}

export function TeamUserFilter({
  teamIds,
  userIds,
  teams,
  users,
  onTeamsChange,
  onUsersChange,
  includeAllOption = true,
  teamLocked = false,
}: TeamUserFilterProps) {
  const t = useTranslations("common.filter");
  const availableUsers = useMemo(
    () => usersForTeams(users, teamIds),
    [users, teamIds]
  );
  const teamOptions = useMemo<MultiSelectOption[]>(
    () => teams.map((team) => ({ value: team.id, label: team.name })),
    [teams]
  );
  const userOptions = useMemo<MultiSelectOption[]>(
    () =>
      availableUsers.map((user) => ({
        value: user.id,
        label: user.name || user.email,
        group: user.teamName ?? undefined,
        keywords: [user.email],
      })),
    [availableUsers]
  );

  const handleTeams = (next: string[]) => {
    // Drop picked users that are no longer in the selected teams
    const allowed = new Set(usersForTeams(users, next).map((u) => u.id));
    onTeamsChange(
      next,
      userIds.filter((id) => allowed.has(id))
    );
  };

  return (
    <Card className="py-4">
      <CardContent className="flex flex-wrap items-center gap-3 px-4">
        <FilterMultiSelect
          label={t("teamPlaceholder")}
          placeholder={includeAllOption ? t("allTeams") : t("teamPlaceholder")}
          options={teamOptions}
          value={teamIds}
          onValueChange={handleTeams}
          disabled={teamLocked}
          className="h-10 w-full min-w-0 sm:w-[240px]"
        />
        <FilterMultiSelect
          label={t("userPlaceholder")}
          placeholder={t("allUsers")}
          options={userOptions}
          value={userIds}
          onValueChange={onUsersChange}
          disabled={availableUsers.length === 0}
          className="h-10 w-full min-w-0 sm:w-[260px]"
        />
      </CardContent>
    </Card>
  );
}
