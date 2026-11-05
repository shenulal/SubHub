// src/app/(auth)/login/page.test.tsx
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

// Mock next-auth before importing page
vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {
    type: string;
    constructor(message?: string) {
      super(message);
      this.type = "CredentialsSignin";
    }
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
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

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => {
    const t = (key: string, values?: Record<string, string | number>) =>
      formatMessage(getMessage(key), values);
    t.raw = (key: string) => getMessage(key);
    return t;
  },
}));

// Mock LoginForm to render key fields for integration testing
vi.mock("@/components/auth/login-form", () => ({
  LoginForm: ({
    translations,
  }: {
    action: (formData: FormData) => void;
    translations: {
      email: string;
      emailPlaceholder: string;
      sendOtp: string;
      sendingOtp: string;
      resendOtp: string;
      resendCooldown: string;
      otpLabel: string;
      otpPlaceholder: string;
      submit: string;
      signingIn: string;
      changeEmail: string;
    };
  }) => (
    <form data-testid="login-credentials-form">
      <label htmlFor="mock-email">{translations.email}</label>
      <input id="mock-email" name="email" type="email" />
      <button type="button" data-testid="send-otp-btn">
        {translations.sendOtp}
      </button>
      <button type="submit">{translations.submit}</button>
    </form>
  ),
}));

import { auth } from "@/lib/auth";
import LoginPage from "./page";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedAuth = auth as any;

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue(null);
  });

  const renderLoginPage = async (searchParams: { error?: string } = {}) => {
    const ui = await LoginPage({ searchParams: Promise.resolve(searchParams) });
    render(ui);
  };

  describe("rendering", () => {
    it("renders the login page", async () => {
      await renderLoginPage();
      expect(screen.getByTestId("login-page")).toBeInTheDocument();
    });

    it("shows the login title", async () => {
      await renderLoginPage();
      expect(
        screen.getByRole("heading", { name: "Sign In" })
      ).toBeInTheDocument();
    });

    it("shows the login description", async () => {
      await renderLoginPage();
      expect(
        screen.getByText("Log in with your email verification code")
      ).toBeInTheDocument();
    });
  });

  describe("email/OTP form", () => {
    it("has an email input field", async () => {
      await renderLoginPage();
      expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    });

    it("has a send-OTP button", async () => {
      await renderLoginPage();
      expect(screen.getByTestId("send-otp-btn")).toBeInTheDocument();
    });

    it("has a login button", async () => {
      await renderLoginPage();
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    it("shows the correct login button text", async () => {
      await renderLoginPage();
      expect(
        screen.getByRole("button", { name: "Log in" })
      ).toBeInTheDocument();
    });
  });

  describe("Google login button", () => {
    it("has a Google login button", async () => {
      await renderLoginPage();
      expect(
        screen.getByRole("button", { name: /google/i })
      ).toBeInTheDocument();
    });

    it("has the button attached to a form", async () => {
      await renderLoginPage();
      const form = screen.getByTestId("login-form");
      expect(form).toBeInTheDocument();
    });
  });

  describe("error messages", () => {
    it("shows a message on a CredentialsSignin error", async () => {
      await renderLoginPage({ error: "CredentialsSignin" });
      expect(
        screen.getByText("The verification code is incorrect")
      ).toBeInTheDocument();
    });
  });

  describe("links", () => {
    it("does not show a sign-up link", async () => {
      await renderLoginPage();
      expect(
        screen.queryByRole("link", { name: /sign up/i })
      ).not.toBeInTheDocument();
    });

    it("does not show Terms of Service / Privacy Policy text", async () => {
      await renderLoginPage();
      expect(screen.queryByText(/Terms of Service/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Privacy Policy/)).not.toBeInTheDocument();
    });
  });
});
