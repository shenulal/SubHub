// src/components/common/quick-create/invite-member-dialog.tsx
"use client";

/**
 * Controlled invite dialog (email, role, optional team) around `createInvitation`
 * (server-checked `members:invite`). Invitees only become users once they
 * accept, so callers get the email back to show an "invitation sent" state.
 */
import { createInvitation } from "@/actions/invitations";
import { getTeams } from "@/actions/teams";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { FieldError, RequiredMark } from "./form-bits";

/** System roles an invitation can carry (workflow enum, not a master). */
const INVITE_ROLES: UserRole[] = ["ADMIN", "APPROVER", "MEMBER", "VIEWER"];
const NO_TEAM = "__none__";
const emailSchema = z.string().trim().email();

export interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefills the email (text typed in a user picker). */
  defaultEmail?: string;
  defaultTeamId?: string | null;
  onInvited?: (email: string) => void;
}

function useTeamOptions(open: boolean) {
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getTeams()
      .then((res) => {
        if (!cancelled && res.success && res.data)
          setTeams(res.data.map((team) => ({ id: team.id, name: team.name })));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open]);
  return teams;
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  defaultEmail = "",
  defaultTeamId = null,
  onInvited,
}: InviteMemberDialogProps) {
  const t = useTranslations("shell.invite");
  const teams = useTeamOptions(open);
  const [email, setEmail] = useState(defaultEmail);
  const [role, setRole] = useState<UserRole>("MEMBER");
  const [teamId, setTeamId] = useState<string>(defaultTeamId ?? NO_TEAM);
  const [error, setError] = useState<string>();
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setEmail(defaultEmail.includes("@") ? defaultEmail : "");
    setRole("MEMBER");
    setTeamId(defaultTeamId ?? NO_TEAM);
    setError(undefined);
  }, [open, defaultEmail, defaultTeamId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // Dialogs are often rendered inside another form; keep its submit untouched.
    event.stopPropagation();
    if (sendingRef.current) return;
    if (!emailSchema.safeParse(email).success) {
      setError(t("invalidEmail"));
      return;
    }
    sendingRef.current = true;
    setIsSending(true);
    try {
      const result = await createInvitation({
        email: email.trim(),
        role,
        teamId: teamId === NO_TEAM ? undefined : teamId,
      });
      if (!result.success) {
        setError(result.errors?.email?.[0] ?? result.message ?? t("error"));
        return;
      }
      toast.success(t("sent", { email: email.trim() }));
      onInvited?.(email.trim());
      onOpenChange(false);
    } catch {
      setError(t("error"));
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !isSending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="invite-email">
              {t("email")}
              <RequiredMark />
            </Label>
            <Input
              id="invite-email"
              type="email"
              autoFocus
              value={email}
              placeholder={t("emailPlaceholder")}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "invite-email-error" : undefined}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSending}
            />
            <FieldError id="invite-email-error" message={error} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="invite-role">{t("role")}</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as UserRole)}
                disabled={isSending}
              >
                <SelectTrigger id="invite-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITE_ROLES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`roles.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="invite-team">{t("team")}</Label>
              <Select
                value={teamId}
                onValueChange={setTeamId}
                disabled={isSending}
              >
                <SelectTrigger id="invite-team" className="w-full">
                  <SelectValue placeholder={t("teamPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEAM}>{t("noTeam")}</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSending}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSending}>
              {isSending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isSending ? t("sending") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
