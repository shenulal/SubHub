// src/lib/services/notification/onboarding.ts
/**
 * Onboarding checklist (11.3): auto-detects completion of the first-run
 * steps for an organisation and persists dismissal per user.
 */
import { prisma } from "@/lib/db";
import { SETTING_DEFINITIONS } from "@/lib/settings/registry";
import { getSettings } from "@/lib/settings/service";
import type {
  OnboardingProgressView,
  OnboardingStep,
  OnboardingStepKey,
} from "@/types/notification";
import { ONBOARDING_STEP_KEYS } from "@/types/notification";
import { readUserReminderLeadDays } from "./preferences";

export const ONBOARDING_STEP_LINKS: Record<OnboardingStepKey, string> = {
  firstSubscription: "/subscriptions/new",
  reminderLeadDays: "/settings/notifications",
  inviteTeammate: "/settings/team",
  approvalPolicy: "/settings/approvals",
  connectIntegration: "/integrations",
  baseCurrency: "/settings/budget",
};

export type OnboardingDetection = Record<OnboardingStepKey, boolean>;

export async function detectOnboardingSteps(
  organizationId: string,
  userId: string
): Promise<OnboardingDetection> {
  const [
    subscriptions,
    subsWithLead,
    invitations,
    memberCount,
    policies,
    integrations,
    mailboxes,
    settings,
    user,
  ] = await Promise.all([
    prisma.subscription.count({ where: { organizationId } }),
    prisma.subscription.count({
      where: { organizationId, NOT: { reminderLeadDays: { isEmpty: true } } },
    }),
    prisma.invitation.count({ where: { organizationId } }),
    prisma.user.count({ where: { organizationId } }),
    prisma.approvalPolicy.count({ where: { organizationId } }),
    prisma.integration.count({ where: { organizationId } }),
    prisma.mailboxConnection.count({ where: { organizationId } }),
    getSettings(organizationId, ["finance.baseCurrency"]),
    prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    }),
  ]);

  const personalLead = readUserReminderLeadDays(user?.preferences);
  const defaultCurrency =
    SETTING_DEFINITIONS["finance.baseCurrency"].defaultValue;
  return {
    firstSubscription: subscriptions > 0,
    reminderLeadDays: Boolean(personalLead) || subsWithLead > 0,
    inviteTeammate: invitations > 0 || memberCount > 1,
    approvalPolicy: policies > 0,
    connectIntegration: integrations > 0 || mailboxes > 0,
    baseCurrency: settings["finance.baseCurrency"] !== defaultCurrency,
  };
}

export function toProgressView(
  detection: OnboardingDetection,
  dismissed: boolean
): OnboardingProgressView {
  const steps: OnboardingStep[] = ONBOARDING_STEP_KEYS.map((key) => ({
    key,
    done: detection[key],
    href: ONBOARDING_STEP_LINKS[key],
  }));
  const completed = steps.filter((s) => s.done).length;
  return {
    steps,
    completed,
    total: steps.length,
    percent: Math.round((completed / steps.length) * 100),
    dismissed,
  };
}

export async function getOnboardingProgressFor(
  organizationId: string,
  userId: string
): Promise<OnboardingProgressView> {
  const [detection, progress] = await Promise.all([
    detectOnboardingSteps(organizationId, userId),
    prisma.onboardingProgress.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { dismissedAt: true },
    }),
  ]);
  await prisma.onboardingProgress.upsert({
    where: { userId_organizationId: { userId, organizationId } },
    create: { userId, organizationId, steps: detection },
    update: { steps: detection },
  });
  return toProgressView(detection, Boolean(progress?.dismissedAt));
}

export async function dismissOnboardingFor(
  organizationId: string,
  userId: string,
  now: Date = new Date()
): Promise<void> {
  await prisma.onboardingProgress.upsert({
    where: { userId_organizationId: { userId, organizationId } },
    create: { userId, organizationId, steps: {}, dismissedAt: now },
    update: { dismissedAt: now },
  });
}
