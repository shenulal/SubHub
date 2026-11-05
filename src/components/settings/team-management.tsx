// src/components/settings/team-management.tsx
"use client";

import { updateOrganizationTeams } from "@/actions/organization";
import { TeamApproverSettings } from "@/components/approvals/team-approver-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface TeamManagementProps {
  initialTeams: string[];
}

export function TeamManagement({ initialTeams }: TeamManagementProps) {
  const t = useTranslations();
  const [teams, setTeams] = useState<string[]>(initialTeams);
  const [newTeam, setNewTeam] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleAddTeam = () => {
    const trimmedName = newTeam.trim();
    if (!trimmedName) {
      toast.error(t("settings.team.toast.empty"));
      return;
    }
    if (teams.includes(trimmedName)) {
      toast.error(t("settings.team.toast.duplicate"));
      return;
    }

    const updatedTeams = [...teams, trimmedName];
    saveTeams(updatedTeams);
    setNewTeam("");
  };

  const handleRemoveTeam = (teamToRemove: string) => {
    const updatedTeams = teams.filter((t) => t !== teamToRemove);
    saveTeams(updatedTeams);
  };

  const saveTeams = (updatedTeams: string[]) => {
    startTransition(async () => {
      const result = await updateOrganizationTeams(updatedTeams);
      if (result.success) {
        setTeams(updatedTeams);
        toast.success(result.message || t("settings.team.toast.updated"));
      } else {
        toast.error(result.message || t("settings.team.toast.saveFailed"));
      }
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTeam();
    }
  };

  return (
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-2">
      <Card className="border-border dark:border-border rounded-md shadow-none">
        <CardHeader>
          <CardTitle className="flex min-w-0 items-center gap-3">
            <span className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md">
              <Users className="size-5" />
            </span>
            {t("settings.team.title")}
          </CardTitle>
          <CardDescription>{t("settings.team.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 팀 추가 입력 */}
          <div className="flex min-w-0 gap-2">
            <Input
              className="min-w-0 flex-1"
              placeholder={t("settings.team.new.placeholder")}
              value={newTeam}
              onChange={(e) => setNewTeam(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isPending}
            />
            <Button
              type="button"
              onClick={handleAddTeam}
              disabled={isPending || !newTeam.trim()}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* 팀 목록 */}
          {teams.length === 0 ? (
            <div className="bg-muted flex flex-col items-center justify-center gap-1 rounded-md py-8 text-center">
              <span className="tonal-neutral mb-2 flex size-10 items-center justify-center rounded-md">
                <Users className="size-5" />
              </span>
              <p className="text-muted-foreground text-[0.9375rem]">
                {t("settings.team.empty.title")}
              </p>
              <p className="text-muted-foreground text-[0.8125rem]">
                {t("settings.team.empty.description")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {teams.map((team) => (
                <div
                  key={team}
                  className="hover:bg-accent/60 flex min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-2 transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge
                      variant="primary"
                      className="max-w-full truncate"
                      title={team}
                    >
                      {team}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveTeam(team)}
                    disabled={isPending}
                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* 팀 수 표시 */}
          {teams.length > 0 && (
            <p className="text-muted-foreground text-[0.8125rem]">
              {t("settings.team.count", { count: teams.length })}
            </p>
          )}
        </CardContent>
      </Card>
      {/* Approvals: default approver per team (feature 2.3) */}
      <TeamApproverSettings />
    </div>
  );
}
