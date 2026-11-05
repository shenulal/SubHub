// src/components/common/quick-create/use-inline-create.tsx
"use client";

/**
 * Hooks that give a picker an inline "+ Create team …" / "+ Invite …" row:
 * `createOption` goes on `SelectContent` / `MultiSelect`, `dialog` is rendered
 * next to the picker. Rows only appear with the matching permission
 * (teams:manage / members:invite); the server actions re-check it.
 */
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { usePermissionFlag } from "@/hooks/use-permission-flag";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { InviteMemberDialog } from "./invite-member-dialog";

export interface InlineCreateOption {
  label: (query: string) => ReactNode;
  onCreate: (query: string) => void;
}

export interface NamedOption {
  id: string;
  name: string;
}

export function useInlineTeamCreate(onCreated?: (team: NamedOption) => void) {
  const t = useTranslations("shell.inline");
  const allowed = usePermissionFlag("teams:manage");
  const [draft, setDraft] = useState<string | null>(null);
  const [created, setCreated] = useState<NamedOption[]>([]);

  const createOption: InlineCreateOption | undefined = allowed
    ? {
        label: (q) => (q ? t("createTeam", { name: q }) : t("createTeamEmpty")),
        onCreate: (q) => setDraft(q),
      }
    : undefined;

  const dialog = (
    <CreateTeamDialog
      open={draft !== null}
      onOpenChange={(open) => !open && setDraft(null)}
      defaultName={draft ?? ""}
      onSuccess={(team) => {
        if (!team) return;
        setCreated((list) => [...list, team]);
        onCreated?.(team);
      }}
    />
  );

  return { createOption, dialog, created, allowed };
}

export function useInlineInvite(defaultTeamId?: string | null) {
  const t = useTranslations("shell.inline");
  const allowed = usePermissionFlag("members:invite");
  const [draft, setDraft] = useState<string | null>(null);

  const createOption: InlineCreateOption | undefined = allowed
    ? {
        label: (q) =>
          q ? t("inviteUser", { email: q }) : t("inviteUserEmpty"),
        onCreate: (q) => setDraft(q),
      }
    : undefined;

  const dialog = (
    <InviteMemberDialog
      open={draft !== null}
      onOpenChange={(open) => !open && setDraft(null)}
      defaultEmail={draft ?? ""}
      defaultTeamId={defaultTeamId ?? null}
    />
  );

  return { createOption, dialog, allowed };
}
