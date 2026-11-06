// src/app/(auth)/login/page.tsx
// Sign-in page: user name or email + password (optional emailed second step),
// passwordless email code when the organisation allows it, Apple when configured.

import { AppleSignInButton } from "@/components/auth/apple-sign-in-button";
import { LoginForm } from "@/components/auth/login-form";
import { PasswordLoginForm } from "@/components/auth/password-login-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { auth, signIn } from "@/lib/auth";
import {
  EMAIL_CODE_PROVIDER_ID,
  resolvePostSignInPath,
  safeCallbackUrl,
} from "@/lib/auth/sign-in-codes";
import { getSignInOptions } from "@/lib/auth/sign-in-options";
import { AuthError } from "next-auth";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

interface LoginPageProps {
  searchParams: Promise<{
    error?: string;
    message?: string;
    method?: string;
    callbackUrl?: string;
  }>;
}

const INFO_KEYS: Record<string, string> = {
  "password-reset": "auth.passwordLogin.info.passwordReset",
  "verify-email": "auth.passwordLogin.info.verifyEmail",
  "password-changed": "auth.passwordLogin.info.passwordChanged",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const t = await getTranslations();
  const { error, message, method, callbackUrl } = await searchParams;

  const session = await auth();
  if (session?.user) {
    if (!session.user.organizationId && session.user.role !== "SUPER_ADMIN") {
      redirect("/onboarding");
    }
    redirect(resolvePostSignInPath(session.user, { callbackUrl }));
  }

  const { appleEnabled, enforceSso, allowSelfSignup, emailCodeEnabled } =
    await getSignInOptions();
  const useEmailCode =
    emailCodeEnabled && method === "email-code" && !enforceSso;
  const target = safeCallbackUrl(callbackUrl);

  const errorMessage = error
    ? error === "CredentialsSignin"
      ? t("auth.login.errors.invalidOtp")
      : t("auth.login.errors.default")
    : null;
  const infoMessage =
    message && INFO_KEYS[message] ? t(INFO_KEYS[message]) : null;

  /** Passwordless email-code sign-in (setting-gated, verified in authorize). */
  async function emailCodeAction(formData: FormData) {
    "use server";
    try {
      await signIn(EMAIL_CODE_PROVIDER_ID, {
        email: formData.get("email") as string,
        otp: formData.get("otp") as string,
        redirectTo: target,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect(`/login?method=email-code&error=${err.type}`);
      }
      throw err;
    }
  }

  return (
    <div data-testid="login-page" className="flex w-full flex-col gap-5">
      {infoMessage && (
        <Alert data-testid="login-info">
          <AlertDescription>{infoMessage}</AlertDescription>
        </Alert>
      )}

      {enforceSso ? (
        <div className="flex flex-col gap-1">
          <h2 className="text-foreground text-2xl font-medium">
            {t("auth.login.title")}
          </h2>
          <p className="text-muted-foreground text-[0.9375rem]">
            {t("platform.auth.ssoOnly")}
          </p>
        </div>
      ) : useEmailCode ? (
        <EmailCodeSection
          action={emailCodeAction}
          errorMessage={errorMessage}
          t={t}
        />
      ) : (
        <PasswordLoginForm
          callbackUrl={target}
          variant="tenant"
          emailCodeHref={emailCodeEnabled ? "/login?method=email-code" : null}
          signupHref={allowSelfSignup ? "/signup" : null}
        />
      )}

      {appleEnabled && (
        <>
          {!enforceSso && (
            <div className="flex items-center gap-3">
              <div className="bg-border h-px flex-1" />
              <p className="text-foreground/70 shrink-0 text-[0.9375rem]">
                {t("auth.login.socialDivider")}
              </p>
              <div className="bg-border h-px flex-1" />
            </div>
          )}
          <AppleSignInButton
            label={t("platform.auth.continueWithApple")}
            action={async () => {
              "use server";
              await signIn("apple", { redirectTo: target });
            }}
          />
        </>
      )}
    </div>
  );
}

type Translate = Awaited<ReturnType<typeof getTranslations>>;

function EmailCodeSection({
  action,
  errorMessage,
  t,
}: {
  action: (formData: FormData) => Promise<void>;
  errorMessage: string | null;
  t: Translate;
}) {
  return (
    <div className="flex flex-col gap-5" data-testid="email-code-login">
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-2xl font-medium">
          {t("auth.login.title")}
        </h2>
        <p className="text-muted-foreground text-[0.9375rem]">
          {t("auth.login.description")}
        </p>
      </div>
      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      <LoginForm
        action={action}
        translations={{
          email: t("auth.login.form.email"),
          emailPlaceholder: t("auth.login.form.emailPlaceholder"),
          sendOtp: t("auth.login.form.sendOtp"),
          sendingOtp: t("auth.login.form.sendingOtp"),
          resendOtp: t("auth.login.form.resendOtp"),
          resendCooldown: t.raw("auth.login.form.resendCooldown") as string,
          otpLabel: t("auth.login.form.otpLabel"),
          otpPlaceholder: t("auth.login.form.otpDescription"),
          submit: t("auth.login.form.submit"),
          signingIn: t("auth.login.form.signingIn"),
          changeEmail: t("auth.login.form.changeEmail"),
          errors: {
            userNotFound: t("auth.login.errors.userNotFound"),
            cooldownActive: t.raw("auth.login.errors.cooldownActive") as string,
            emailSendFailed: t("auth.login.errors.emailSendFailed"),
            default: t("auth.login.errors.default"),
          },
        }}
      />
      <Link
        href="/login"
        className="text-primary text-center text-[0.9375rem] hover:underline"
      >
        {t("auth.passwordLogin.passwordLink")}
      </Link>
    </div>
  );
}
