// src/app/(auth)/signup/page.test.tsx
import messages from "@/i18n/messages/en.json";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getMessage = (key: string): string => {
  return key.split(".").reduce((acc, part) => {
    if (typeof acc === "object" && acc !== null && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return key;
  }, messages as unknown) as string;
};

const formatMessage = (
  template: string,
  values?: Record<string, string | number>
) => {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, token) =>
    values[token] !== undefined ? String(values[token]) : `{${token}}`
  );
};

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
  signIn: vi.fn(),
  isAppleSignInEnabled: () => false,
}));

vi.mock("@/lib/auth/sign-in-options", () => ({
  getSignInOptions: vi.fn().mockResolvedValue({
    appleEnabled: false,
    enforceSso: false,
    allowSelfSignup: true,
  }),
}));

// Mock registerUser action
vi.mock("@/actions/auth-credentials", () => ({
  registerUser: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations:
    async () => (key: string, values?: Record<string, string | number>) =>
      formatMessage(getMessage(key), values),
}));

import SignupPage from "./page";

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render signup form", async () => {
    render(await SignupPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Sign up")).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Create account/i })
    ).toBeInTheDocument();
  });

  it("should have link to login page", async () => {
    render(await SignupPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText(/Already have an account/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Log in/ })).toHaveAttribute(
      "href",
      "/login"
    );
  });

  it("should have Google OAuth button", async () => {
    render(await SignupPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText(/Continue with Google/)).toBeInTheDocument();
  });

  describe("error handling", () => {
    it("should display Google login button when EMAIL_EXISTS_OAUTH_GOOGLE error", async () => {
      render(
        await SignupPage({
          searchParams: Promise.resolve({ error: "EMAIL_EXISTS_OAUTH_GOOGLE" }),
        })
      );

      expect(
        screen.getByText(/already registered with Google/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Log in with Google/ })
      ).toBeInTheDocument();
    });

    it("should display login link when EMAIL_EXISTS_CREDENTIALS error", async () => {
      render(
        await SignupPage({
          searchParams: Promise.resolve({ error: "EMAIL_EXISTS_CREDENTIALS" }),
        })
      );

      expect(
        screen.getByText(/This email is already registered/)
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Go to login/ })).toHaveAttribute(
        "href",
        "/login"
      );
    });

    it("should display generic error message for unknown error code", async () => {
      render(
        await SignupPage({
          searchParams: Promise.resolve({ error: "UNKNOWN_ERROR" }),
        })
      );

      expect(screen.getByText(/An error occurred/)).toBeInTheDocument();
    });

    it("should display generic error for EMAIL_EXISTS", async () => {
      render(
        await SignupPage({
          searchParams: Promise.resolve({ error: "EMAIL_EXISTS" }),
        })
      );

      expect(screen.getByText(/already in use/)).toBeInTheDocument();
    });
  });
});
