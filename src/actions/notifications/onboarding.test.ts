// src/actions/notifications/onboarding.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/require-auth", () => ({ requireOrganization: vi.fn() }));
vi.mock("@/lib/services/notification/onboarding", () => ({
  getOnboardingProgressFor: vi.fn(),
  dismissOnboardingFor: vi.fn(),
}));

import { requireOrganization } from "@/lib/auth/require-auth";
import {
  dismissOnboardingFor,
  getOnboardingProgressFor,
} from "@/lib/services/notification/onboarding";
import { revalidatePath } from "next/cache";
import { dismissOnboarding, getOnboardingProgress } from "./onboarding";

describe("onboarding actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireOrganization).mockResolvedValue({
      userId: "u1",
      organizationId: "org-1",
    } as never);
  });

  it("returns progress for the signed-in member", async () => {
    const view = {
      steps: [],
      completed: 0,
      total: 6,
      percent: 0,
      dismissed: false,
    };
    vi.mocked(getOnboardingProgressFor).mockResolvedValue(view);
    expect(await getOnboardingProgress()).toEqual({
      success: true,
      data: view,
    });
    expect(getOnboardingProgressFor).toHaveBeenCalledWith("org-1", "u1");
  });

  it("dismisses and revalidates the dashboard", async () => {
    const res = await dismissOnboarding();
    expect(dismissOnboardingFor).toHaveBeenCalledWith("org-1", "u1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(res.success).toBe(true);
  });

  it("maps unexpected failures", async () => {
    vi.mocked(getOnboardingProgressFor).mockRejectedValue(new Error("db"));
    const res = await getOnboardingProgress();
    expect(res.success).toBe(false);
  });
});
