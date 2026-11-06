"use client";

import { acceptInvitationWithPassword } from "@/actions/invitation-signup";
import { PasswordField } from "@/components/auth/password-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_PROVIDER_ID } from "@/lib/auth/sign-in-codes";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

export interface InviteAccountFormProps {
  token: string;
  email: string;
  passwordHint: string;
  minLength: number;
}

/** Create the invited account: name, optional user name, password. */
export function InviteAccountForm({
  token,
  email,
  passwordHint,
  minLength,
}: InviteAccountFormProps) {
  const t = useTranslations("auth");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (formData.get("password") !== formData.get("confirmPassword")) {
      setError(t("changePassword.mismatch"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await acceptInvitationWithPassword(token, formData);
      if (!result.success) {
        setError(result.message ?? t("passwordLogin.errors.default"));
        return;
      }
      const signedIn = await signIn(PASSWORD_PROVIDER_ID, {
        identifier: email,
        password: String(formData.get("password") ?? ""),
        redirect: false,
      });
      window.location.assign(
        signedIn?.ok && !signedIn.error ? "/dashboard" : "/login"
      );
    } catch {
      setError(t("passwordLogin.errors.default"));
    } finally {
      setPending(false);
    }
  }

  const labels = {
    showLabel: t("passwordLogin.showPassword"),
    hideLabel: t("passwordLogin.hidePassword"),
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-5"
      data-testid="invite-account-form"
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-email">{t("signup.form.email")}</Label>
        <Input id="invite-email" value={email} readOnly className="bg-muted" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">{t("signup.form.name")}</Label>
        <Input id="name" name="name" autoComplete="name" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="username">{t("adminPassword.username")}</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          placeholder={t("security.usernamePlaceholder")}
        />
        <p className="text-muted-foreground text-[0.8125rem]">
          {t("security.usernameHint")}
        </p>
      </div>
      <PasswordField
        id="password"
        name="password"
        label={t("signup.form.password")}
        autoComplete="new-password"
        hint={passwordHint}
        minLength={minLength}
        {...labels}
      />
      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label={t("changePassword.confirm")}
        autoComplete="new-password"
        minLength={minLength}
        {...labels}
      />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("passwordLogin.signingIn") : t("invite.createAccount")}
      </Button>
    </form>
  );
}
