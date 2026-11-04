// src/components/approvals/team-approver-settings.tsx
"use client";

/**
 * Feature 2.3 — default approver per team. Self-fetching so it can be mounted
 * inside the existing Team settings card without changing its props.
 */
import {
  getTeamApproverOptions,
  setTeamApprover,
} from "@/actions/approvals/team-approver";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { UserCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { userLabel } from "./format";

const NONE = "__none__";

export function TeamApproverSettings() {
  const t = useTranslations("approvals.teamApprover");
  const tc = useTranslations("approvals.common");
  const [isPending, startTransition] = useTransition();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["approvals", "team-approvers"],
    queryFn: async () => {
      const res = await getTeamApproverOptions();
      if (!res.success || !res.data) throw new Error(res.error ?? "failed");
      return res.data;
    },
  });

  const change = (teamId: string, value: string) =>
    startTransition(async () => {
      const res = await setTeamApprover(teamId, value === NONE ? null : value);
      if (!res.success) toast.error(res.error ?? tc("errorGeneric"));
      else toast.success(t("saved"));
      await refetch();
    });

  return (
    <Card className="border-border rounded-sm shadow-sm transition-shadow hover:shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : data.teams.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          <ul className="divide-border divide-y">
            {data.teams.map((team) => (
              <li
                key={team.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{team.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {t("members", { count: team.memberCount })}
                  </p>
                </div>
                <Select
                  value={team.approver?.id ?? NONE}
                  onValueChange={(v) => change(team.id, v)}
                  disabled={isPending}
                >
                  <SelectTrigger
                    className="w-full sm:w-64"
                    aria-label={t("approver")}
                  >
                    <SelectValue placeholder={t("none")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("none")}</SelectItem>
                    {data.users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {userLabel(u, tc("unknownUser"))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
