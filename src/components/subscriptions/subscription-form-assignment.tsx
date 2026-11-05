// src/components/subscriptions/subscription-form-assignment.tsx
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { type Control, Controller, useWatch } from "react-hook-form";
import type { SubscriptionFormValues } from "./subscription-form-schema";

export interface TeamOption {
  id: string;
  name: string;
}

export interface UserOption {
  id: string;
  name: string | null;
  email: string;
  teamId: string | null;
}

export interface AppWithTeams {
  id: string;
  name: string;
  teams: TeamOption[];
}

interface SubscriptionFormAssignmentProps {
  control: Control<SubscriptionFormValues>;
  apps: AppWithTeams[];
  users: UserOption[];
  isAdmin: boolean;
  isPending: boolean;
  billingType?: string;
  setValue: (
    name: keyof SubscriptionFormValues,
    value: string | string[] | null
  ) => void;
}

export function SubscriptionFormAssignment({
  control,
  apps,
  users,
  isAdmin,
  isPending,
  billingType,
  setValue,
}: SubscriptionFormAssignmentProps) {
  const isPerSeat = billingType === "PER_SEAT";
  const t = useTranslations("subscriptions.form.assignment");

  // Watch the selected app ID
  const selectedAppId = useWatch({ control, name: "appId" });
  const watchedTeamIds = useWatch({ control, name: "teamIds" });
  const selectedTeamIds = useMemo(() => watchedTeamIds ?? [], [watchedTeamIds]);
  const watchedUserIds = useWatch({ control, name: "assignedUserIds" });
  const selectedUserIds = useMemo(() => watchedUserIds ?? [], [watchedUserIds]);

  // Teams assigned to the selected app
  const availableTeams = useMemo(() => {
    if (!selectedAppId) return [];
    const selectedApp = apps.find((app) => app.id === selectedAppId);
    return selectedApp?.teams ?? [];
  }, [selectedAppId, apps]);

  // Reset the previous team selection when the app changes
  useEffect(() => {
    if (availableTeams.length === 0 && selectedTeamIds.length > 0) {
      setValue("teamIds", []);
    }
  }, [availableTeams, selectedTeamIds, setValue]);

  // Show only users in the selected teams (shown if they belong to any selected team)
  const availableUsers = useMemo(() => {
    if (selectedTeamIds.length === 0) return [];
    return users.filter(
      (user) => user.teamId && selectedTeamIds.includes(user.teamId)
    );
  }, [users, selectedTeamIds]);

  // Selected user details
  const selectedUsers = useMemo(() => {
    return availableUsers.filter((user) => selectedUserIds.includes(user.id));
  }, [availableUsers, selectedUserIds]);

  // Reset selected users when teams change (drop users outside the selected teams)
  // PER_SEAT subscriptions manage user assignment in the Pricing card, so skip team-based filtering
  useEffect(() => {
    if (isPerSeat) return;
    if (selectedUserIds.length > 0 && selectedTeamIds.length > 0) {
      const validUserIds = selectedUserIds.filter((id) =>
        users.some(
          (u) => u.id === id && u.teamId && selectedTeamIds.includes(u.teamId)
        )
      );
      if (validUserIds.length !== selectedUserIds.length) {
        setValue("assignedUserIds", validUserIds);
      }
    }
  }, [isPerSeat, selectedTeamIds, selectedUserIds, users, setValue]);

  const teamOptions = useMemo(
    () => availableTeams.map((team) => ({ value: team.id, label: team.name })),
    [availableTeams]
  );
  const userOptions = useMemo(
    () =>
      availableUsers.map((user) => ({
        value: user.id,
        label: user.name ?? user.email,
        keywords: [user.email],
      })),
    [availableUsers]
  );

  // Only ADMIN sees the assignment card
  if (!isAdmin) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Team multi-select */}
        <div className="space-y-2">
          <Label htmlFor="assignment-teams">{t("teamLabel")}</Label>
          {availableTeams.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {selectedAppId ? t("noTeamsForApp") : t("selectAppFirst")}
            </p>
          ) : (
            <Controller
              control={control}
              name="teamIds"
              render={() => (
                <MultiSelect
                  id="assignment-teams"
                  aria-label={t("teamLabel")}
                  options={teamOptions}
                  value={selectedTeamIds}
                  onValueChange={(ids) => setValue("teamIds", ids)}
                  disabled={isPending}
                  placeholder={t("teamPlaceholder")}
                  searchPlaceholder={t("teamPlaceholder")}
                  emptyText={t("noTeamsForApp")}
                  moreLabel={(count) => `+${count}`}
                  maxChips={3}
                />
              )}
            />
          )}
        </div>

        {/* User assignment (ADMIN only; managed in the license card for PER_SEAT) */}
        {isAdmin && !isPerSeat && (
          <div className="space-y-2">
            <Label htmlFor="assignment-users">{t("userLabel")}</Label>
            {selectedTeamIds.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t("selectTeamFirst")}
              </p>
            ) : availableUsers.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t("noUsersForTeam")}
              </p>
            ) : (
              <MultiSelect
                id="assignment-users"
                aria-label={t("userLabel")}
                options={userOptions}
                value={selectedUserIds}
                onValueChange={(ids) => setValue("assignedUserIds", ids)}
                disabled={isPending}
                placeholder={t("selectUsersPlaceholder")}
                searchPlaceholder={t("searchUsers")}
                emptyText={t("noUsersFound")}
                moreLabel={(count) => `+${count}`}
                maxChips={3}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
