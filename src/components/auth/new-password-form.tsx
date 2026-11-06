"use client";

import { changePassword, resetPassword } from "@/actions/password";
import { PasswordField } from "@/components/auth/password-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

type Mode =
  | { kind: "reset"; token: string }
  | { kind: "change"; requireCurrent: boolean };

export interface NewPasswordFormProps {
  mode: Mode;
  passwordHint: string;
  minLength: number;
  /** Where to go after success (full navigation so the session refreshes). */
  successHref?: string;
  /** Inline success message instead of navigating (profile). */
  onSuccess?: () => void;
  submitLabel?: string;
  /** Full-width submit (auth card); otherwise compact (settings card). */
  fullWidth?: boolean;
}

/**
 * New-password form used by /reset-password/[token], /change-password and the
 * profile security card. The server validates the policy and history.
 */
export function NewPasswordForm({
  mode,
  passwordHint,
  minLength,
  successHref,
  onSuccess,
  submitLabel,
  fullWidth = false,
}: NewPasswordFormProps) {
  const t = useTranslations("auth");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    if (formData.get("newPassword") !== formData.get("confirmPassword")) {
      setError(t("changePassword.mismatch"));
      return;
    }
    setPending(true);
    setError(null);
    setDone(false);
    try {
      let result;
      if (mode.kind === "reset") {
        const data = new FormData();
        data.set("token", mode.token);
        data.set("password", String(formData.get("newPassword") ?? ""));
        result = await resetPassword(data);
      } else {
        result = await changePassword({ success: false }, formData);
      }
      if (!result.success) {
        setError(result.message ?? t("passwordLogin.errors.default"));
        return;
      }
      if (successHref) {
        window.location.assign(successHref);
        return;
      }
      form.reset();
      setDone(true);
      onSuccess?.();
    } catch {
      setError(t("passwordLogin.errors.default"));
    } finally {
      setPending(false);
    }
  }

  const fieldLabels = {
    showLabel: t("passwordLogin.showPassword"),
    hideLabel: t("passwordLogin.hidePassword"),
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-5"
      data-testid="new-password-form"
    >
      {error && (
        <Alert variant="destructive" data-testid="new-password-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {done && (
        <div
          className="tonal-success rounded-md p-3 text-[0.875rem]"
          role="status"
        >
          {t("changePassword.success")}
        </div>
      )}
      {mode.kind === "change" && mode.requireCurrent && (
        <PasswordField
          id="currentPassword"
          name="currentPassword"
          label={t("changePassword.current")}
          autoComplete="current-password"
          {...fieldLabels}
        />
      )}
      <PasswordField
        id="newPassword"
        name="newPassword"
        label={t("changePassword.new")}
        autoComplete="new-password"
        hint={passwordHint}
        minLength={minLength}
        {...fieldLabels}
      />
      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label={t("changePassword.confirm")}
        autoComplete="new-password"
        minLength={minLength}
        {...fieldLabels}
      />
      <Button
        type="submit"
        className={fullWidth ? "w-full" : "w-full sm:w-auto sm:self-start"}
        disabled={pending}
      >
        {pending
          ? t("changePassword.saving")
          : (submitLabel ?? t("changePassword.submit"))}
      </Button>
    </form>
  );
}
