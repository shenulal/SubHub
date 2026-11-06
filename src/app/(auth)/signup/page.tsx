// src/app/(auth)/signup/page.tsx
// Sign-up page (name, email, optional user name, password; Apple when configured)

import { AppleSignInButton } from "@/components/auth/apple-sign-in-button";
import { SignupForm } from "@/components/auth/signup-form";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { auth, signIn } from "@/lib/auth";
import {
  describePasswordPolicy,
  getSignupPasswordPolicy,
} from "@/lib/auth/password-policy";
import { getSignInOptions } from "@/lib/auth/sign-in-options";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function SignupPage() {
  const t = await getTranslations();
  const session = await auth();

  if (session?.user) {
    redirect(session.user.organizationId ? "/dashboard" : "/onboarding");
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

  const policy = await getSignupPasswordPolicy();

  return (
    <div data-testid="signup-page" className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-2xl font-medium">
          {t("auth.signup.title")}
        </h2>
        <p className="text-muted-foreground text-[0.9375rem]">
          {t("auth.signup.description")}
        </p>
      </div>

      {enforceSso ? (
        <p className="text-muted-foreground text-center text-[0.9375rem]">
          {t("platform.auth.ssoOnly")}
        </p>
      ) : (
        <SignupForm
          passwordHint={describePasswordPolicy(policy)}
          minLength={policy.minLength}
        />
      )}

      {appleEnabled && (
        <>
          {!enforceSso && (
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-foreground/70 shrink-0 text-[0.9375rem]">
                {t("auth.login.socialDivider")}
              </span>
              <Separator className="flex-1" />
            </div>
          )}
          <AppleSignInButton
            label={t("platform.auth.continueWithApple")}
            action={async () => {
              "use server";
              await signIn("apple", { redirectTo: "/dashboard" });
            }}
          />
        </>
      )}

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
