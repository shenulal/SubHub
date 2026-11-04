// src/components/notifications/onboarding-checklist.test.tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/notifications/onboarding", () => ({
  getOnboardingProgress: vi.fn(),
  dismissOnboarding: vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

import {
  dismissOnboarding,
  getOnboardingProgress,
} from "@/actions/notifications/onboarding";
import { OnboardingChecklist } from "./onboarding-checklist";

const progress = {
  steps: [
    {
      key: "firstSubscription" as const,
      done: true,
      href: "/subscriptions/new",
    },
    { key: "inviteTeammate" as const, done: false, href: "/settings/team" },
  ],
  completed: 1,
  total: 2,
  percent: 50,
  dismissed: false,
};

describe("OnboardingChecklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dismissOnboarding).mockResolvedValue({ success: true });
  });

  it("renders steps and progress from initial data", () => {
    render(<OnboardingChecklist initialProgress={progress} />);
    expect(
      screen.getByRole("link", { name: /팀원 초대|Invite a teammate/ })
    ).toHaveAttribute("href", "/settings/team");
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText(/1/)).toBeInTheDocument();
  });

  it("loads progress itself when not provided", async () => {
    vi.mocked(getOnboardingProgress).mockResolvedValue({
      success: true,
      data: progress,
    });
    render(<OnboardingChecklist />);
    await screen.findByRole("progressbar");
    expect(getOnboardingProgress).toHaveBeenCalled();
  });

  it("hides when dismissed or complete", () => {
    const { container } = render(
      <OnboardingChecklist initialProgress={{ ...progress, dismissed: true }} />
    );
    expect(container).toBeEmptyDOMElement();
    const done = render(
      <OnboardingChecklist
        initialProgress={{ ...progress, completed: 2, percent: 100 }}
      />
    );
    expect(done.container).toBeEmptyDOMElement();
  });

  it("dismisses via the action", async () => {
    const { container } = render(
      <OnboardingChecklist initialProgress={progress} />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /체크리스트 숨기기|Hide checklist/ })
    );
    await waitFor(() => expect(dismissOnboarding).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
