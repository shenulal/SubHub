// src/app/(auth)/reset-password/[token]/page.tsx
// Password reset page

import { resetPassword } from "@/actions/password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

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

  if (!token) {
    return (
      <TokenProblem
        title={t("auth.reset.invalid.title")}
        description={t("auth.reset.invalid.description")}
        cta={t("auth.reset.invalid.cta")}
      />
    );
  }

  // Validate the token
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (!resetToken) {
    return (
      <TokenProblem
        title={t("auth.reset.invalidLink.title")}
        description={t("auth.reset.invalidLink.description")}
        cta={t("auth.reset.invalidLink.cta")}
      />
    );
  }

  // Check expiry
  if (new Date() > resetToken.expires) {
    return (
      <TokenProblem
        title={t("auth.reset.expired.title")}
        description={t("auth.reset.expired.description")}
        cta={t("auth.reset.expired.cta")}
      />
    );
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-2xl font-medium">
          {t("auth.reset.title")}
        </h2>
        <p className="text-muted-foreground text-[0.9375rem]">
          {t("auth.reset.description")}
        </p>
      </div>
      <form
        action={async (formData: FormData) => {
          "use server";
          formData.set("token", token);
          const result = await resetPassword(formData);
          if (result.success) {
            redirect("/login?message=password-reset");
          }
          // TODO: move error handling to a client component
        }}
        className="flex flex-col gap-5"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">{t("auth.reset.form.password")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder={t("auth.reset.form.passwordPlaceholder")}
            required
          />
          <p className="text-muted-foreground text-[0.8125rem]">
            {t("auth.reset.form.passwordHint")}
          </p>
        </div>
        <Button type="submit" className="w-full">
          {t("auth.reset.form.submit")}
        </Button>
      </form>
    </div>
  );
}
