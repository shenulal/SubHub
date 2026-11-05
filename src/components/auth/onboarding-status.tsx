// src/components/auth/onboarding-status.tsx
"use client";

/**
 * Onboarding outcomes other than "create an organisation": joining by email
 * domain, and the notices shown when no organisation can be created
 * (single-tenant installation already set up, SaaS sign-up closed, tenant
 * deactivated). The rules live in `@/lib/deployment/tenancy`.
 */
import { joinOrganizationByDomain } from "@/actions/organization";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/types";
import { Ban, Building2, LogOut, MailCheck } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

function SignOutButton() {
  const t = useTranslations("platform.onboarding");
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      <LogOut className="size-4" />
      {t("signOut")}
    </Button>
  );
}

export function DomainJoinCard({
  organizationName,
}: {
  organizationName: string;
}) {
  const t = useTranslations("platform.onboarding");
  const [state, formAction, isPending] = useActionState(
    async (_prev: ActionState | null) =>
      (await joinOrganizationByDomain()) ?? null,
    null
  );
  return (
    <div data-testid="onboarding-join" className="flex w-full flex-col gap-5">
      <div className="flex items-start gap-3">
        <div className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md">
          <Building2 className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-foreground text-2xl font-medium">
            {t("joinTitle", { name: organizationName })}
          </h1>
          <p className="text-muted-foreground text-[0.9375rem]">
            {t("joinBody", { name: organizationName })}
          </p>
        </div>
      </div>
      {state && !state.success && state.error && (
        <p
          role="alert"
          className="tonal-error rounded-md px-3 py-2 text-[0.8125rem]"
        >
          {state.error}
        </p>
      )}
      <form action={formAction}>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending
            ? t("joining")
            : t("joinAction", { name: organizationName })}
        </Button>
      </form>
      <SignOutButton />
    </div>
  );
}

export type OnboardingNoticeKind =
  | "installation-ready"
  | "signup-closed"
  | "deactivated";

const NOTICE_KEYS: Record<
  OnboardingNoticeKind,
  { title: string; body: string }
> = {
  "installation-ready": {
    title: "installationReadyTitle",
    body: "installationReadyBody",
  },
  "signup-closed": { title: "signupClosedTitle", body: "signupClosedBody" },
  deactivated: { title: "deactivatedTitle", body: "deactivatedBody" },
};

export function OnboardingNotice({
  kind,
  organizationName,
}: {
  kind: OnboardingNoticeKind;
  organizationName?: string;
}) {
  const t = useTranslations("platform.onboarding");
  const keys = NOTICE_KEYS[kind];
  const Icon = kind === "deactivated" ? Ban : MailCheck;
  return (
    <div
      data-testid={`onboarding-notice-${kind}`}
      className="flex w-full flex-col gap-5"
    >
      <div className="flex items-start gap-3">
        <div
          className={
            kind === "deactivated"
              ? "tonal-error flex size-10 shrink-0 items-center justify-center rounded-md"
              : "tonal-info flex size-10 shrink-0 items-center justify-center rounded-md"
          }
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-foreground text-2xl font-medium">
            {t(keys.title)}
          </h1>
          <p className="text-muted-foreground text-[0.9375rem]">
            {t(keys.body, { name: organizationName ?? "" })}
          </p>
        </div>
      </div>
      <SignOutButton />
    </div>
  );
}
