// src/app/(auth)/onboarding/page.test.tsx
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { getAllMessages } from "@/i18n/messages";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OnboardingPage from "./page";

vi.mock("@/actions/organization", () => ({
  createOrganization: vi.fn(),
  joinOrganizationByDomain: vi.fn(),
}));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/deployment/tenancy", () => ({ getOnboardingState: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

import { auth } from "@/lib/auth";
import { getOnboardingState } from "@/lib/deployment/tenancy";

const messages = getAllMessages("en") as AbstractIntlMessages;
const renderWithIntl = (ui: React.ReactElement) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({
    user: { id: "user-1", role: "MEMBER", organizationId: null },
  } as never);
});

describe("OnboardingForm", () => {
  it("renders the title, description and inputs", () => {
    renderWithIntl(<OnboardingForm />);
    expect(screen.getByTestId("onboarding-page")).toBeInTheDocument();
    expect(
      screen.getByText("Start right after creating your organization")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/choose your goals to tailor the dashboard/)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Organization name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/AGA HQ/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Get started/i })
    ).toBeInTheDocument();
  });

  it("allows typing an organization name", async () => {
    const user = userEvent.setup();
    renderWithIntl(<OnboardingForm />);
    const input = screen.getByLabelText(/Organization name/i);
    await user.type(input, "Test Company");
    expect(input).toHaveValue("Test Company");
  });

  it("explains single-tenant first-run setup", () => {
    renderWithIntl(<OnboardingForm firstRun />);
    expect(screen.getByTestId("onboarding-first-run")).toHaveTextContent(
      "First-run setup"
    );
  });
});

describe("OnboardingPage (deployment mode)", () => {
  it("offers organisation creation when allowed", async () => {
    vi.mocked(getOnboardingState).mockResolvedValue({
      kind: "create",
      firstRun: false,
    });
    renderWithIntl(await OnboardingPage());
    expect(screen.getByLabelText(/Organization name/i)).toBeInTheDocument();
    expect(screen.queryByTestId("onboarding-first-run")).toBeNull();
  });

  it("single-tenant after setup: no create form, invitation message instead", async () => {
    vi.mocked(getOnboardingState).mockResolvedValue({
      kind: "invite-only",
      reason: "installation-ready",
    });
    renderWithIntl(await OnboardingPage());
    expect(
      screen.getByTestId("onboarding-notice-installation-ready")
    ).toHaveTextContent("This installation is already set up");
    expect(screen.queryByLabelText(/Organization name/i)).toBeNull();
  });

  it("offers joining the organisation of the email domain", async () => {
    vi.mocked(getOnboardingState).mockResolvedValue({
      kind: "join",
      organization: { id: "org-1", name: "QA Holdings" },
    });
    renderWithIntl(await OnboardingPage());
    expect(
      screen.getByRole("button", { name: "Join QA Holdings" })
    ).toBeInTheDocument();
  });

  it("explains a deactivated tenant", async () => {
    vi.mocked(getOnboardingState).mockResolvedValue({
      kind: "deactivated",
      organizationName: "Acme",
    });
    renderWithIntl(await OnboardingPage());
    expect(
      screen.getByTestId("onboarding-notice-deactivated")
    ).toHaveTextContent("Acme has been deactivated");
  });

  it("sends members to the dashboard and super admins to the console", async () => {
    vi.mocked(getOnboardingState).mockResolvedValue({ kind: "member" });
    await expect(OnboardingPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    vi.mocked(auth).mockResolvedValue({
      user: { id: "sa", role: "SUPER_ADMIN", organizationId: null },
    } as never);
    await expect(OnboardingPage()).rejects.toThrow(
      "NEXT_REDIRECT:/super-admin"
    );
  });
});
