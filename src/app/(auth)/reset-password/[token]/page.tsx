// src/app/(auth)/reset-password/[token]/page.tsx
// Password reset page (single-use, expiring token from the emailed link)

import { NewPasswordForm } from "@/components/auth/new-password-form";
import { Button } from "@/components/ui/button";
import {
  describePasswordPolicy,
  getPasswordPolicy,
} from "@/lib/auth/password-policy";
import { findResetToken } from "@/lib/auth/password-reset";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

interface ResetPasswordPageProps {
  params: Promise<{ token: string }>;
}

/** Invalid / expired token state, rendered inside the auth layout card. */
function TokenProblem({
  title,
  description,
  cta,
}: {
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <div className="flex w-full flex-col gap-5 text-center">
      <div className="flex flex-col gap-1">
        <h2 className="text-error text-2xl font-medium">{title}</h2>
        <p className="text-muted-foreground text-[0.9375rem]">{description}</p>
      </div>
      <Button asChild className="w-full">
        <Link href="/forgot-password">{cta}</Link>
      </Button>
    </div>
  );
}

export default async function ResetPasswordPage({
  params,
}: ResetPasswordPageProps) {
  const t = await getTranslations();
  const { token } = await params;
  const lookup = await findResetToken(token ?? "");

  if (lookup.status === "expired") {
    return (
      <TokenProblem
        title={t("auth.reset.expired.title")}
        description={t("auth.reset.expired.description")}
        cta={t("auth.reset.expired.cta")}
      />
    );
  }
  if (lookup.status !== "valid" || !lookup.email) {
    return (
      <TokenProblem
        title={t("auth.reset.invalidLink.title")}
        description={t("auth.reset.invalidLink.description")}
        cta={t("auth.reset.invalidLink.cta")}
      />
    );
  }

  const account = await prisma.user.findUnique({
    where: { email: lookup.email },
    select: { organizationId: true },
  });
  const policy = await getPasswordPolicy(account?.organizationId ?? null);

  return (
    <div
      className="flex w-full flex-col gap-5"
      data-testid="reset-password-page"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-2xl font-medium">
          {t("auth.reset.title")}
        </h2>
        <p className="text-muted-foreground text-[0.9375rem]">
          {t("auth.reset.description")}
        </p>
      </div>
      <NewPasswordForm
        mode={{ kind: "reset", token }}
        passwordHint={describePasswordPolicy(policy)}
        minLength={policy.minLength}
        successHref="/login?message=password-reset"
        submitLabel={t("auth.reset.form.submit")}
        fullWidth
      />
      <Link
        href="/login"
        className="text-primary text-center text-[0.9375rem] hover:underline"
      >
        {t("auth.forgot.footer.backToLogin")}
      </Link>
    </div>
  );
}
