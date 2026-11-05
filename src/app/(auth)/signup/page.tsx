// src/app/(auth)/signup/page.tsx
// Sign-up page (email/password + Google OAuth)

import { registerUser } from "@/actions/auth-credentials";
import { AppleSignInButton } from "@/components/auth/apple-sign-in-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { auth, signIn } from "@/lib/auth";
import { getSignInOptions } from "@/lib/auth/sign-in-options";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

interface SignupPageProps {
  searchParams: Promise<{
    error?: string;
  }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const t = await getTranslations();
  const { error } = await searchParams;
  // Check for an already signed-in user
  const session = await auth();

  if (session?.user) {
    if (session.user.organizationId) {
      redirect("/dashboard");
    } else {
      redirect("/onboarding");
    }
  }

  const { appleEnabled, enforceSso, allowSelfSignup } =
    await getSignInOptions();

  if (!allowSelfSignup) {
    return (
      <div data-testid="signup-page" className="flex w-full flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-foreground text-2xl font-medium">
            {t("auth.signup.title")}
          </h2>
          <p className="text-muted-foreground text-[0.9375rem]">
            {t("platform.auth.selfSignupDisabled")}
          </p>
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">{t("auth.signup.footer.login")}</Link>
        </Button>
      </div>
    );
  }

  const errorConfig: Record<
    string,
    { message: string; type: "google" | "credentials" | "default" }
  > = {
    EMAIL_EXISTS_OAUTH_GOOGLE: {
      message: t("auth.signup.errors.emailExistsGoogle"),
      type: "google",
    },
    EMAIL_EXISTS_CREDENTIALS: {
      message: t("auth.signup.errors.emailExistsCredentials"),
      type: "credentials",
    },
    EMAIL_EXISTS: {
      message: t("auth.signup.errors.emailExists"),
      type: "default",
    },
    default: {
      message: t("auth.signup.errors.default"),
      type: "default",
    },
  };
  const errorLabels = {
    googleLogin: t("auth.signup.errors.googleLogin"),
    loginLink: t("auth.signup.errors.loginLink"),
  };

  return (
    <div data-testid="signup-page" className="flex w-full flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-2xl font-medium">
          {t("auth.signup.title")}
        </h2>
        <p className="text-muted-foreground text-[0.9375rem]">
          {t("auth.signup.description")}
        </p>
      </div>

      {/* Error message */}
      <ErrorAlert error={error} config={errorConfig} labels={errorLabels} />

      {/* Google sign-up button - hidden on duplicate-email errors */}
      {!["google", "credentials"].includes(
        errorConfig[error ?? ""]?.type ?? ""
      ) && (
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <Button type="submit" variant="outline" className="w-full">
            <GoogleIcon className="size-[18px] shrink-0" />
            {t("auth.signup.social.googleContinue")}
          </Button>
        </form>
      )}

      {appleEnabled && (
        <div className="-mt-2">
          <AppleSignInButton
            label={t("platform.auth.continueWithApple")}
            action={async () => {
              "use server";
              await signIn("apple", { redirectTo: "/dashboard" });
            }}
          />
        </div>
      )}

      {enforceSso ? (
        <p className="text-muted-foreground text-center text-[0.9375rem]">
          {t("platform.auth.ssoOnly")}
        </p>
      ) : (
        <>
          {/* Divider */}
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-foreground/70 shrink-0 text-[0.9375rem]">
              {t("auth.signup.emailDivider")}
            </span>
            <Separator className="flex-1" />
          </div>

          {/* Email/password form */}
          <form
            action={async (formData: FormData) => {
              "use server";
              const result = await registerUser(formData);
              const { redirect } = await import("next/navigation");

              if (result.success) {
                redirect("/login?message=verify-email");
              }
              if (result.error) {
                redirect(`/signup?error=${result.error}`);
              }
            }}
            className="flex flex-col gap-5"
          >
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="name"
                className="text-foreground block text-[0.8125rem] font-medium"
              >
                {t("auth.signup.form.name")}
              </label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder={t("auth.signup.form.namePlaceholder")}
                required
              />
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-foreground block text-[0.8125rem] font-medium"
              >
                {t("auth.signup.form.email")}
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder={t("auth.signup.form.emailPlaceholder")}
                required
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-foreground block text-[0.8125rem] font-medium"
              >
                {t("auth.signup.form.password")}
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder={t("auth.signup.form.passwordPlaceholder")}
                required
              />
              <p className="text-muted-foreground text-[0.8125rem]">
                {t("auth.signup.form.passwordHint")}
              </p>
            </div>

            {/* Sign-up button */}
            <Button type="submit" className="w-full">
              {t("auth.signup.form.submit")}
            </Button>
          </form>
        </>
      )}

      {/* Footer */}
      <div className="flex flex-col gap-3 text-center">
        <p className="text-foreground/80 text-[0.9375rem]">
          {t("auth.signup.footer.hasAccount")}{" "}
          <Link href="/login" className="text-primary hover:underline">
            {t("auth.signup.footer.login")}
          </Link>
        </p>
        <p className="text-muted-foreground text-[0.8125rem]">
          {t("auth.signup.footer.agreePrefix")}{" "}
          <Link href="/terms" className="text-primary hover:underline">
            {t("auth.signup.footer.terms")}
          </Link>{" "}
          {t("auth.signup.footer.and")}{" "}
          <Link href="/privacy" className="text-primary hover:underline">
            {t("auth.signup.footer.privacy")}
          </Link>
          {t("auth.signup.footer.agreeSuffix")}
        </p>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

/**
 * Error message alert component
 */
function ErrorAlert({
  error,
  config,
  labels,
}: {
  error: string | undefined;
  config: Record<
    string,
    { message: string; type: "google" | "credentials" | "default" }
  >;
  labels: { googleLogin: string; loginLink: string };
}) {
  if (!error) return null;

  const errorConfig = config[error] || config.default;

  return (
    <div className="tonal-error flex flex-col gap-3 rounded-md p-4">
      <p className="text-[0.9375rem] font-medium">{errorConfig.message}</p>

      {/* Google OAuth error: show the Google login button */}
      {errorConfig.type === "google" && (
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <Button type="submit" variant="outline" size="sm" className="w-full">
            <GoogleIcon className="size-4 shrink-0" />
            {labels.googleLogin}
          </Button>
        </form>
      )}

      {/* Credentials error: link to the login page */}
      {errorConfig.type === "credentials" && (
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href="/login">{labels.loginLink}</Link>
        </Button>
      )}
    </div>
  );
}
