// src/app/(auth)/onboarding/page.tsx
// Onboarding: create the organisation, join one by email domain, or explain why
// neither is possible. The deployment mode decides (see @/lib/deployment/tenancy).

import { OnboardingForm } from "@/components/auth/onboarding-form";
import {
  DomainJoinCard,
  OnboardingNotice,
} from "@/components/auth/onboarding-status";
import { auth } from "@/lib/auth";
import { getOnboardingState } from "@/lib/deployment/tenancy";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if ((session.user.role as string) === "SUPER_ADMIN") redirect("/super-admin");

  const state = await getOnboardingState(session.user.id);
  switch (state.kind) {
    case "member":
      redirect("/dashboard");
    case "create":
      return <OnboardingForm firstRun={state.firstRun} />;
    case "join":
      return <DomainJoinCard organizationName={state.organization.name} />;
    case "deactivated":
      return (
        <OnboardingNotice
          kind="deactivated"
          organizationName={state.organizationName}
        />
      );
    case "invite-only":
      return <OnboardingNotice kind={state.reason} />;
  }
}
