// src/actions/notifications/onboarding.ts
"use server";

import { requireOrganization } from "@/lib/auth/require-auth";
import { withLogging } from "@/lib/logging";
import {
  dismissOnboardingFor,
  getOnboardingProgressFor,
} from "@/lib/services/notification/onboarding";
import type { ActionState } from "@/types";
import type { OnboardingProgressView } from "@/types/notification";
import { revalidatePath } from "next/cache";
import { toActionError } from "./shared";

const DASHBOARD_PATH = "/dashboard";

async function _getOnboardingProgress(): Promise<
  ActionState<OnboardingProgressView>
> {
  try {
    const { userId, organizationId } = await requireOrganization();
    const data = await getOnboardingProgressFor(organizationId, userId);
    return { success: true, data };
  } catch (error) {
    return toActionError(error, "getOnboardingProgress");
  }
}
export const getOnboardingProgress = withLogging(
  "getOnboardingProgress",
  _getOnboardingProgress
);

async function _dismissOnboarding(): Promise<ActionState> {
  try {
    const { userId, organizationId } = await requireOrganization();
    await dismissOnboardingFor(organizationId, userId);
    revalidatePath(DASHBOARD_PATH);
    return { success: true };
  } catch (error) {
    return toActionError(error, "dismissOnboarding");
  }
}
export const dismissOnboarding = withLogging(
  "dismissOnboarding",
  _dismissOnboarding
);
