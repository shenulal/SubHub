// src/app/(auth)/login/page.test.tsx
import { getAllMessages } from "@/i18n/messages";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const messages = getAllMessages("en");

const getMessage = (key: string): string => {
  return key.split(".").reduce((acc, part) => {
    if (typeof acc === "object" && acc !== null && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return key;
  }, messages as unknown) as string;
};

vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {
    type = "CredentialsSignin";
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  isAppleSignInEnabled: () => false,
}));

const options = {
  appleEnabled: false,
  enforceSso: false,
  allowSelfSignup: true,
  emailCodeEnabled: false,
};
vi.mock("@/lib/auth/sign-in-options", () => ({
  getSignInOptions: vi.fn(async () => options),
}));

const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => {
    const t = (key: string) => getMessage(key);
    t.raw = (key: string) => getMessage(key);
    return t;
  },
}));

vi.mock("@/components/auth/password-login-form", () => ({
  PasswordLoginForm: (props: {
    variant?: string;
    callbackUrl?: string;
    emailCodeHref?: string | null;
    signupHref?: string | null;
  }) => (
    <div
      data-testid="password-login"
      data-variant={props.variant}
      data-callback={props.callbackUrl}
      data-email-code={props.emailCodeHref ?? ""}
      data-signup={props.signupHref ?? ""}
    />
  ),
}));

vi.mock("@/components/auth/login-form", () => ({
  LoginForm: () => <form data-testid="login-credentials-form" />,
}));

import { auth } from "@/lib/auth";
import LoginPage from "./page";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedAuth = auth as any;

type Params = {
  error?: string;
  message?: string;
  method?: string;
  callbackUrl?: string;
};

const renderLoginPage = async (searchParams: Params = {}) => {
  const ui = await LoginPage({ searchParams: Promise.resolve(searchParams) });
  render(ui);
};

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue(null);
    Object.assign(options, {
      appleEnabled: false,
      enforceSso: false,
      allowSelfSignup: true,
      emailCodeEnabled: false,
    });
  });

  it("renders the user name / password form by default", async () => {
    await renderLoginPage();
    const form = screen.getByTestId("password-login");
    expect(form).toHaveAttribute("data-variant", "tenant");
    expect(form).toHaveAttribute("data-callback", "/dashboard");
    expect(form).toHaveAttribute("data-signup", "/signup");
    expect(form).toHaveAttribute("data-email-code", "");
  });

  it("has no Google sign-in", async () => {
    await renderLoginPage();
    expect(screen.queryByRole("button", { name: /google/i })).toBeNull();
    expect(screen.queryByText(/google/i)).toBeNull();
  });

  it("ignores ?method=email-code while email-code sign-in is off", async () => {
    await renderLoginPage({ method: "email-code" });
    expect(screen.getByTestId("password-login")).toBeInTheDocument();
    expect(screen.queryByTestId("login-credentials-form")).toBeNull();
  });

  it("offers and renders email-code sign-in when the setting is on", async () => {
    options.emailCodeEnabled = true;
    await renderLoginPage();
    expect(screen.getByTestId("password-login")).toHaveAttribute(
      "data-email-code",
      "/login?method=email-code"
    );
    await renderLoginPage({ method: "email-code", error: "CredentialsSignin" });
    expect(screen.getByTestId("login-credentials-form")).toBeInTheDocument();
    expect(
      screen.getByText("The verification code is incorrect")
    ).toBeInTheDocument();
  });

  it("hides the sign-up link when self sign-up is closed", async () => {
    options.allowSelfSignup = false;
    await renderLoginPage();
    expect(screen.getByTestId("password-login")).toHaveAttribute(
      "data-signup",
      ""
    );
  });

  it("shows the password-reset confirmation", async () => {
    await renderLoginPage({ message: "password-reset" });
    expect(screen.getByTestId("login-info")).toHaveTextContent(
      "Your password has been updated"
    );
  });

  it("keeps only safe relative callback URLs", async () => {
    await renderLoginPage({ callbackUrl: "//evil.example" });
    expect(screen.getByTestId("password-login")).toHaveAttribute(
      "data-callback",
      "/dashboard"
    );
  });

  it("shows the SSO-only notice instead of the form when SSO is enforced", async () => {
    Object.assign(options, { enforceSso: true, appleEnabled: true });
    await renderLoginPage();
    expect(screen.queryByTestId("password-login")).toBeNull();
    expect(screen.getByText(/requires single sign-on/)).toBeInTheDocument();
  });

  it("sends a signed-in platform super admin to /super-admin", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "sa", role: "SUPER_ADMIN", organizationId: null },
    });
    await expect(renderLoginPage()).rejects.toThrow("REDIRECT:/super-admin");
  });

  it("sends a signed-in tenant user to the dashboard", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "u", role: "ADMIN", organizationId: "org-1" },
    });
    await expect(renderLoginPage()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("sends a forced password change to /change-password", async () => {
    mockedAuth.mockResolvedValue({
      user: {
        id: "u",
        role: "MEMBER",
        organizationId: "org-1",
        mustChangePassword: true,
      },
    });
    await expect(renderLoginPage()).rejects.toThrow(
      "REDIRECT:/change-password?callbackUrl=%2Fdashboard"
    );
  });
});
