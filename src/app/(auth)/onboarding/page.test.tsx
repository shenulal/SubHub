// src/app/(auth)/onboarding/page.test.tsx
import messages from "@/i18n/messages/en.json";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OnboardingPage from "./page";

// createOrganization mock
vi.mock("@/actions/organization", () => ({
  createOrganization: vi.fn(),
}));

describe("OnboardingPage", () => {
  const renderWithIntl = (ui: React.ReactElement) =>
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        {ui}
      </NextIntlClientProvider>
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders the onboarding page", () => {
      renderWithIntl(<OnboardingPage />);
      expect(screen.getByTestId("onboarding-page")).toBeInTheDocument();
    });

    it("shows the page title", () => {
      renderWithIntl(<OnboardingPage />);
      expect(
        screen.getByText("Start right after creating your organization")
      ).toBeInTheDocument();
    });

    it("shows the page description", () => {
      renderWithIntl(<OnboardingPage />);
      expect(
        screen.getByText(/choose your goals to tailor the dashboard/)
      ).toBeInTheDocument();
    });
  });

  describe("form elements", () => {
    it("has an organization name input", () => {
      renderWithIntl(<OnboardingPage />);
      expect(screen.getByLabelText(/Organization name/i)).toBeInTheDocument();
    });

    it("has a placeholder on the organization name input", () => {
      renderWithIntl(<OnboardingPage />);
      expect(screen.getByPlaceholderText(/AGA HQ/)).toBeInTheDocument();
    });

    it("has a submit button", () => {
      renderWithIntl(<OnboardingPage />);
      expect(
        screen.getByRole("button", { name: /Get started/i })
      ).toBeInTheDocument();
    });
  });

  describe("input behavior", () => {
    it("allows typing an organization name", async () => {
      const user = userEvent.setup();
      renderWithIntl(<OnboardingPage />);

      const input = screen.getByLabelText(/Organization name/i);
      await user.type(input, "Test Company");

      expect(input).toHaveValue("Test Company");
    });
  });
});
