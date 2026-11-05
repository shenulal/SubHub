// src/components/team/invite-member-inline-form.tsx
"use client";

/**
 * Settings → Members invite form. Client-side so the admin gets feedback
 * (pending state, field error, "invitation sent" toast) and can create a team
 * from the team picker without leaving the page.
 */
import { createInvitation } from "@/actions/invitations";
import {
  FieldError,
  RequiredMark,
} from "@/components/common/quick-create/form-bits";
import { useInlineTeamCreate } from "@/components/common/quick-create/use-inline-create";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserRole } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

const ROLES: UserRole[] = ["ADMIN", "APPROVER", "MEMBER", "VIEWER"];
const NO_TEAM = "__none__";

interface InviteMemberInlineFormProps {
  teams: { id: string; name: string }[];
}

export function InviteMemberInlineForm({ teams }: InviteMemberInlineFormProps) {
  const t = useTranslations("teamMembers.inviteForm");
  const ts = useTranslations("shell.invite");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("MEMBER");
  const [teamId, setTeamId] = useState(NO_TEAM);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const teamCreate = useInlineTeamCreate((team) => setTeamId(team.id));
  const allTeams = [...teams, ...teamCreate.created];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (isPending) return;
    setError(undefined);
    startTransition(async () => {
      const result = await createInvitation({
        email: email.trim(),
        role,
        teamId: teamId === NO_TEAM ? undefined : teamId,
      });
      if (!result.success) {
        setError(result.errors?.email?.[0] ?? result.message ?? t("error"));
        return;
      }
      toast.success(ts("sent", { email: email.trim() }));
      setEmail("");
      setRole("MEMBER");
      setTeamId(NO_TEAM);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
      <div className="min-w-0 space-y-1.5 sm:col-span-2">
        <Label htmlFor="email">
          {t("email")}
          <RequiredMark />
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "invite-inline-error" : undefined}
          disabled={isPending}
        />
        <FieldError id="invite-inline-error" message={error} />
      </div>
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="role">{t("role")}</Label>
        <Select
          name="role"
          value={role}
          onValueChange={(v) => setRole(v as UserRole)}
          disabled={isPending}
        >
          <SelectTrigger id="role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`roles.${value.toLowerCase()}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="teamId">{t("teamAssignment")}</Label>
        <Select value={teamId} onValueChange={setTeamId} disabled={isPending}>
          <SelectTrigger id="teamId" className="w-full">
            <SelectValue placeholder={t("teamPlaceholder")} />
          </SelectTrigger>
          <SelectContent createOption={teamCreate.createOption}>
            <SelectItem value={NO_TEAM}>{ts("noTeam")}</SelectItem>
            {allTeams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {teamCreate.dialog}
      </div>
      <div className="flex flex-wrap justify-end gap-3 sm:col-span-2">
        <Button type="submit" disabled={isPending || !email.trim()}>
          {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          {isPending ? t("inviting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
