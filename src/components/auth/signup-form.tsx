"use client";

import { registerUser } from "@/actions/auth-credentials";
import { PasswordField } from "@/components/auth/password-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_PROVIDER_ID } from "@/lib/auth/sign-in-codes";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, type FormEvent } from "react";

export interface SignupFormProps {
  /** Password policy summary from Settings > Security. */
  passwordHint: string;
  minLength: number;
}

/** Self sign-up: name, email, optional user name and password. */
export function SignupForm({ passwordHint, minLength }: SignupFormProps) {
  const t = useTranslations("auth");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setErrors({});
    const formData = new FormData(event.currentTarget);
    try {
      const result = await registerUser(formData);
      if (!result.success) {
        setErrors(result.errors ?? {});
        setMessage(result.message ?? t("signup.errors.default"));
        return;
      }
      const signedIn = await signIn(PASSWORD_PROVIDER_ID, {
        identifier: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        redirect: false,
      });
      window.location.assign(
        signedIn?.ok && !signedIn.error
          ? "/dashboard"
          : "/login?message=verify-email"
      );
    } catch {
      setMessage(t("signup.errors.default"));
    } finally {
      setPending(false);
    }
  }

  const fieldError = (key: string) => errors[key]?.[0] ?? null;

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-5"
      data-testid="signup-form"
    >
      {message && (
        <Alert variant="destructive">
          <AlertDescription>
            {message}
            {message === "This email is already registered" && (
              <>
                {" "}
                <Link href="/login" className="underline">
                  {t("signup.errors.loginLink")}
                </Link>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}
      <TextField
        id="name"
        label={t("signup.form.name")}
        placeholder={t("signup.form.namePlaceholder")}
        autoComplete="name"
        error={fieldError("name")}
      />
      <TextField
        id="email"
        type="email"
        label={t("signup.form.email")}
        placeholder={t("signup.form.emailPlaceholder")}
        autoComplete="email"
        error={fieldError("email")}
      />
      <TextField
        id="username"
        label={t("adminPassword.username")}
        placeholder={t("security.usernamePlaceholder")}
        autoComplete="username"
        required={false}
        hint={t("security.usernameHint")}
        error={fieldError("username")}
      />
      <PasswordField
        id="password"
        name="password"
        label={t("signup.form.password")}
        autoComplete="new-password"
        hint={passwordHint}
        error={fieldError("password")}
        minLength={minLength}
        showLabel={t("passwordLogin.showPassword")}
        hideLabel={t("passwordLogin.hidePassword")}
      />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("passwordLogin.signingIn") : t("signup.form.submit")}
      </Button>
    </form>
  );
}

function TextField({
  id,
  label,
  placeholder,
  autoComplete,
  type = "text",
  required = true,
  hint,
  error,
}: {
  id: string;
  label: string;
  placeholder?: string;
  autoComplete?: string;
  type?: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoCapitalize={id === "username" ? "none" : undefined}
        required={required}
        aria-invalid={error ? true : undefined}
      />
      {error ? (
        <p className="text-destructive text-[0.8125rem]">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-[0.8125rem]">{hint}</p>
      ) : null}
    </div>
  );
}
