"use client";

// src/components/reports/team-user-filter-router.tsx
/**
 * URL-driven TeamUserFilter: the selection lives in `?teamId=a,b&userId=c`
 * so server-rendered reports re-query on change.
 */
import { writeReportFilterParams } from "@/lib/filters/report-filter-params";
import { useRouter, useSearchParams } from "next/navigation";
import {
  TeamUserFilter,
  type TeamFilterOption,
  type UserFilterOption,
} from "./team-user-filter";

interface TeamUserFilterRouterProps {
  basePath: string;
  teamIds: string[];
  userIds: string[];
  teams: TeamFilterOption[];
  users: UserFilterOption[];
  includeAllOption?: boolean;
  teamLocked?: boolean;
}

export function TeamUserFilterRouter({
  basePath,
  teamIds,
  userIds,
  teams,
  users,
  includeAllOption,
  teamLocked,
}: TeamUserFilterRouterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const push = (nextTeamIds: string[], nextUserIds: string[]) => {
    const params = writeReportFilterParams(
      new URLSearchParams(searchParams.toString()),
      { teamIds: nextTeamIds, userIds: nextUserIds }
    );
    const queryString = params.toString();
    router.push(queryString ? `${basePath}?${queryString}` : basePath);
  };

  return (
    <TeamUserFilter
      teamIds={teamIds}
      userIds={userIds}
      teams={teams}
      users={users}
      onTeamsChange={push}
      onUsersChange={(nextUserIds) => push(teamIds, nextUserIds)}
      includeAllOption={includeAllOption}
      teamLocked={teamLocked}
    />
  );
}
