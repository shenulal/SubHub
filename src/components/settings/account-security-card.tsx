"use client";

import {
  setOwnTwoStepVerification,
  updateOwnUsername,
} from "@/actions/account-security";
import { NewPasswordForm } from "@/components/auth/new-password-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

export interface AccountSecurityCardProps {
  username: string | null;
  hasPassword: boolean;
  passwordChangedAt: string | null;
  loginOtpEnabled: boolean;
  loginOtpRequired: boolean;
  passwordHint: string;
  minLength: number;
}

/** Profile > Sign-in & security: user name, password, two-step verification. */
export function AccountSecurityCard(props: AccountSecurityCardProps) {
  const t = useTranslations("auth.security");
  return (
    <section className="space-y-6" data-testid="account-security">
      <div className="flex min-w-0 items-center gap-4 border-b pb-5">
        <div className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md">
          <KeyRound className="size-5" />
        </div>
        <div className="min-w-0 space-y-1">
          <h3 className="text-foreground text-lg leading-snug font-medium">
            {t("title")}
          </h3>
          <p className="text-muted-foreground text-[0.8125rem]">
            {t("description")}
          </p>
        </div>
      </div>
      <UsernameForm username={props.username} />
      <Separator />
      <TwoStepToggle
        enabled={props.loginOtpEnabled}
        required={props.loginOtpRequired}
      />
      <Separator />
      <PasswordSection {...props} />
    </section>
  );
}

function UsernameForm({ username }: { username: string | null }) {
  const t = useTranslations("auth.security");
  const [state, action, pending] = useActionState(updateOwnUsername, {
    success: false,
  });
  useEffect(() => {
    if (state.success) toast.success(t("usernameSaved"));
  }, [state, t]);
  const error = !state.success ? state.errors?.username?.[0] : null;
  return (
    <form
      action={action}
      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
    >
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="username" className="text-[0.9375rem]">
          {t("username")}
        </Label>
        <Input
          id="username"
          name="username"
          defaultValue={username ?? ""}
          placeholder={t("usernamePlaceholder")}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {t("saveUsername")}
      </Button>
      <p
        className={`text-[0.8125rem] sm:col-span-2 ${error ? "text-destructive" : "text-muted-foreground"}`}
      >
        {error ?? t("usernameHint")}
      </p>
    </form>
  );
}

function TwoStepToggle({
  enabled,
  required,
}: {
  enabled: boolean;
  required: boolean;
}) {
  const t = useTranslations("auth.security");
  const [checked, setChecked] = useState(enabled);
  const [pending, startTransition] = useTransition();
  function onChange(next: boolean) {
    setChecked(next);
    startTransition(async () => {
      const result = await setOwnTwoStepVerification(next);
      if (result.success) toast.success(t("twoStepSaved"));
      else {
        setChecked(!next);
        toast.error(result.message ?? "");
      }
    });
  }
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <Label htmlFor="two-step" className="text-[0.9375rem]">
          {t("twoStep")}
        </Label>
        <p className="text-muted-foreground text-[0.8125rem]">
          {t("twoStepHint")}
        </p>
        {required && (
          <Badge variant="info" className="mt-1">
            {t("twoStepRequired")}
          </Badge>
        )}
      </div>
      <Switch
        id="two-step"
        checked={required || checked}
        disabled={required || pending}
        onCheckedChange={onChange}
      />
    </div>
  );
}

function PasswordSection({
  hasPassword,
  passwordChangedAt,
  passwordHint,
  minLength,
}: AccountSecurityCardProps) {
  const t = useTranslations("auth.security");
  const tPassword = useTranslations("auth.changePassword");
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[0.9375rem] font-medium">{t("changePassword")}</p>
          <p className="text-muted-foreground text-[0.8125rem]">
            {passwordChangedAt
              ? t("passwordChangedAt", {
                  date: format(new Date(passwordChangedAt), "yyyy-MM-dd"),
                })
              : t("passwordNeverSet")}
          </p>
        </div>
        {!open && (
          <Button type="button" variant="outline" onClick={() => setOpen(true)}>
            {t("changePassword")}
          </Button>
        )}
      </div>
      {open && (
        <NewPasswordForm
          mode={{ kind: "change", requireCurrent: hasPassword }}
          passwordHint={passwordHint}
          minLength={minLength}
          onSuccess={() => {
            toast.success(tPassword("success"));
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
