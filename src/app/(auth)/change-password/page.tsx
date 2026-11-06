// src/app/(auth)/change-password/page.tsx
// Forced password change after an administrator set a temporary password
// (every guarded route redirects here until it is done). Also usable directly.

import { logout } from "@/actions/auth";
import { NewPasswordForm } from "@/components/auth/new-password-form";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import {
  describePasswordPolicy,
  getPasswordPolicy,
} from "@/lib/auth/password-policy";
import { resolvePostSignInPath } from "@/lib/auth/sign-in-codes";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Change password" };

interface ChangePasswordPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function ChangePasswordPage({
  searchParams,
}: ChangePasswordPageProps) {
  const t = await getTranslations();
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/change-password");
  const { callbackUrl } = await searchParams;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      organizationId: true,
      passwordHash: true,
      mustChangePassword: true,
    },
  });
  const policy = await getPasswordPolicy(user?.organizationId ?? null);
  const forced = Boolean(user?.mustChangePassword);
  const next = resolvePostSignInPath(
    { role: session.user.role, organizationId: session.user.organizationId },
    { callbackUrl: forced ? callbackUrl : (callbackUrl ?? "/settings/profile") }
  );

  return (
    <div
      className="flex w-full flex-col gap-5"
      data-testid="change-password-page"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-2xl font-medium">
          {t("auth.changePassword.title")}
        </h2>
        <p className="text-muted-foreground text-[0.9375rem]">
          {forced
            ? t("auth.changePassword.forcedDescription")
            : t("auth.changePassword.description")}
        </p>
      </div>
      <NewPasswordForm
        mode={{ kind: "change", requireCurrent: Boolean(user?.passwordHash) }}
        passwordHint={describePasswordPolicy(policy)}
        minLength={policy.minLength}
        successHref={next}
        fullWidth
      />
      <form action={logout}>
        <Button type="submit" variant="ghost" className="w-full">
          {t("auth.changePassword.signOut")}
        </Button>
      </form>
    </div>
  );
}
