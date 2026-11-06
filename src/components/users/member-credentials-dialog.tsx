"use client";

import {
  getMemberCredentials,
  setMemberCredentials,
  type MemberCredentialInfo,
} from "@/actions/member-credentials";
import { Can } from "@/components/common/can";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { ActionState } from "@/types";
import { format } from "date-fns";
import { KeyRound, Lock, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

const GENERATED_LENGTH = 16;
const CLASSES = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "abcdefghijkmnopqrstuvwxyz",
  "23456789",
  "!@#$%^&*-_=+?",
];

/** Random temporary password with every character class. */
export function generateTemporaryPassword(length = GENERATED_LENGTH): string {
  const all = CLASSES.join("");
  const pick = (set: string) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return set[buf[0] % set.length];
  };
  const chars = CLASSES.map(pick);
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

interface MemberCredentialsButtonProps {
  userId: string;
  memberName: string;
  onSaved?: () => void;
}

/** "Set password" button + dialog on the member detail page (admins). */
export function MemberCredentialsButton(props: MemberCredentialsButtonProps) {
  const t = useTranslations("auth.adminPassword");
  const [open, setOpen] = useState(false);
  return (
    <Can permission="members:manage_credentials">
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <KeyRound className="mr-1 h-4 w-4" />
        {t("button")}
      </Button>
      {open && (
        <MemberCredentialsDialog {...props} onClose={() => setOpen(false)} />
      )}
    </Can>
  );
}

function MemberCredentialsDialog({
  userId,
  memberName,
  onSaved,
  onClose,
}: MemberCredentialsButtonProps & { onClose: () => void }) {
  const t = useTranslations("auth.adminPassword");
  const [info, setInfo] = useState<MemberCredentialInfo | null>(null);
  const [password, setPassword] = useState("");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    (prev, formData) => setMemberCredentials(userId, prev, formData),
    { success: false }
  );

  useEffect(() => {
    let active = true;
    getMemberCredentials(userId).then((result) => {
      if (!active) return;
      if (result.success && result.data) setInfo(result.data);
      else toast.error(result.error ?? "");
    });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!state.success) return;
    toast.success(t("success"));
    onSaved?.();
    onClose();
  }, [state, t, onSaved, onClose]);

  const error = !state.success ? (state.error ?? state.message) : null;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {memberName} · {t("description")}
          </DialogDescription>
        </DialogHeader>
        <form
          action={action}
          className="space-y-5"
          data-testid="member-credentials-form"
        >
          {info?.lockedUntil && (
            <div className="tonal-warning flex items-center gap-2 rounded-md p-3 text-[0.875rem]">
              <Lock className="size-4 shrink-0" />
              {t("locked", {
                date: format(new Date(info.lockedUntil), "yyyy-MM-dd HH:mm"),
              })}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="member-username">{t("username")}</Label>
            <Input
              id="member-username"
              name="username"
              key={info?.username ?? "none"}
              defaultValue={info?.username ?? ""}
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="member-password">{t("password")}</Label>
            <div className="flex gap-2">
              <Input
                id="member-password"
                name="password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                spellCheck={false}
                className="min-w-0 flex-1 font-mono"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setPassword(generateTemporaryPassword())}
              >
                <RefreshCw className="mr-1 h-4 w-4" />
                {t("generate")}
              </Button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-[0.9375rem]">
            <Checkbox name="mustChangePassword" defaultChecked value="true" />
            {t("mustChange")}
          </label>
          {info?.lockedUntil && (
            <label className="flex items-center gap-2 text-[0.9375rem]">
              <Checkbox name="unlock" defaultChecked value="true" />
              {t("unlock")}
            </label>
          )}
          {error && (
            <p className="text-destructive text-[0.8125rem]" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending || !info}>
              {pending ? t("saving") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
