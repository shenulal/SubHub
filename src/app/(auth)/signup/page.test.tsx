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

vi.mock("@/lib/auth/password-policy", () => ({
  getSignupPasswordPolicy: vi.fn().mockResolvedValue({
    minLength: 10,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSymbol: true,
    historyCount: 0,
  }),
  describePasswordPolicy: () => "Use at least 10 characters.",
}));

vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));

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
    render(await SignupPage());

    expect(screen.getByText("Sign up")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Create account/i })
    ).toBeInTheDocument();
  });

  it("offers an optional user name and shows the password policy", async () => {
    render(await SignupPage());

    expect(screen.getByLabelText(/User name/)).not.toBeRequired();
    expect(screen.getByText("Use at least 10 characters.")).toBeInTheDocument();
  });

  it("should have link to login page", async () => {
    render(await SignupPage());

    expect(screen.getByText(/Already have an account/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Log in/ })).toHaveAttribute(
      "href",
      "/login"
    );
  });

  it("has no Google sign-up", async () => {
    render(await SignupPage());

    expect(screen.queryByText(/Google/)).not.toBeInTheDocument();
  });
});
