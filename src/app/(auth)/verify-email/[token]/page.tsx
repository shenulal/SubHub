// src/app/(auth)/verify-email/[token]/page.tsx
// Email verification page

import { verifyEmail } from "@/actions/auth-credentials";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

interface VerifyEmailPageProps {
  params: Promise<{ token: string }>;
}

export default async function VerifyEmailPage({
  params,
}: VerifyEmailPageProps) {
  const t = await getTranslations();
  const { token } = await params;

  if (!token) {
    return (
      <div className="flex w-full flex-col gap-5 text-center">
        <div className="flex flex-col gap-1">
          <h2 className="text-error text-2xl font-medium">
            {t("auth.verify.invalid.title")}
          </h2>
          <p className="text-muted-foreground text-[0.9375rem]">
            {t("auth.verify.invalid.description")}
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/login">{t("auth.verify.invalid.cta")}</Link>
        </Button>
      </div>
    );
  }

  const result = await verifyEmail(token);

  return (
    <div className="flex w-full flex-col gap-5 text-center">
      <div className="flex flex-col items-center gap-1">
        {result.success ? (
          <>
            <div className="tonal-success mb-3 flex size-14 items-center justify-center rounded-full">
              <Check className="size-7" />
            </div>
            <h2 className="text-success text-2xl font-medium">
              {t("auth.verify.success.title")}
            </h2>
            <p className="text-muted-foreground text-[0.9375rem]">
              {result.message}
            </p>
          </>
        ) : (
          <>
            <div className="tonal-error mb-3 flex size-14 items-center justify-center rounded-full">
              <X className="size-7" />
            </div>
            <h2 className="text-error text-2xl font-medium">
              {t("auth.verify.failure.title")}
            </h2>
            <p className="text-muted-foreground text-[0.9375rem]">
              {result.message}
            </p>
          </>
        )}
      </div>
      <Button asChild className="w-full">
        <Link href="/login">{t("auth.verify.cta")}</Link>
      </Button>
    </div>
  );
}
