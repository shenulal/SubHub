import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signIn = vi.fn();
const getSession = vi.fn();
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signIn(...args),
  getSession: () => getSession(),
}));
vi.mock("@/components/ui/input-otp", () => ({
  InputOTP: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <input
      aria-label="Verification code"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  InputOTPGroup: ({ children }: { children: React.ReactNode }) => children,
  InputOTPSlot: () => null,
  InputOTPSeparator: () => null,
}));

import { PasswordLoginForm } from "./password-login-form";

const assign = vi.fn();

function fillAndSubmit(identifier = "jane", password = "secret") {
  fireEvent.change(screen.getByLabelText("Email or user name"), {
    target: { value: identifier },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, assign },
  });
});

describe("PasswordLoginForm", () => {
  it("signs in with the password provider and goes to the callback URL", async () => {
    signIn.mockResolvedValue({ ok: true, error: undefined });
    getSession.mockResolvedValue({
      user: { role: "ADMIN", organizationId: "org-1" },
    });
    render(<PasswordLoginForm callbackUrl="/subscriptions" />);
    fillAndSubmit(" jane ", "pw");
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/subscriptions"));
    expect(signIn).toHaveBeenCalledWith("password", {
      identifier: "jane",
      password: "pw",
      audience: "tenant",
      redirect: false,
    });
  });

  it("sends a super admin who used the tenant page to /super-admin", async () => {
    signIn.mockResolvedValue({ ok: true });
    getSession.mockResolvedValue({
      user: { role: "SUPER_ADMIN", organizationId: null },
    });
    render(<PasswordLoginForm />);
    fillAndSubmit();
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/super-admin"));
  });

  it("goes to the change-password screen when a change is required", async () => {
    signIn.mockResolvedValue({ ok: true });
    getSession.mockResolvedValue({
      user: { role: "MEMBER", organizationId: "o", mustChangePassword: true },
    });
    render(<PasswordLoginForm />);
    fillAndSubmit();
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(
        "/change-password?callbackUrl=%2Fdashboard"
      )
    );
  });

  it("shows the generic error for bad credentials", async () => {
    signIn.mockResolvedValue({
      ok: false,
      error: "CredentialsSignin",
      code: "invalid_credentials",
    });
    render(<PasswordLoginForm />);
    fillAndSubmit();
    expect(
      await screen.findByText("The user name, email or password is incorrect.")
    ).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it("shows the lockout message", async () => {
    signIn.mockResolvedValue({ ok: false, code: "account_locked", error: "x" });
    render(<PasswordLoginForm />);
    fillAndSubmit();
    expect(await screen.findByText(/temporarily locked/)).toBeInTheDocument();
  });

  it("asks for the emailed code and submits it with the password", async () => {
    signIn
      .mockResolvedValueOnce({ ok: false, error: "x", code: "otp_required" })
      .mockResolvedValueOnce({ ok: true });
    getSession.mockResolvedValue({
      user: { role: "MEMBER", organizationId: "o" },
    });
    render(<PasswordLoginForm />);
    fillAndSubmit("jane", "pw");
    const code = await screen.findByLabelText("Verification code");
    fireEvent.change(code, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/dashboard"));
    expect(signIn).toHaveBeenLastCalledWith("password", {
      identifier: "jane",
      password: "pw",
      otp: "123456",
      audience: "tenant",
      redirect: false,
    });
  });

  it("platform variant hides sign-up and email-code links", () => {
    render(
      <PasswordLoginForm
        variant="platform"
        signupHref="/signup"
        emailCodeHref="/login?method=email-code"
      />
    );
    expect(screen.getByText("Platform sign-in")).toBeInTheDocument();
    expect(screen.queryByText("Sign up")).toBeNull();
    expect(screen.queryByTestId("email-code-link")).toBeNull();
  });

  it("tenant variant shows the optional links", () => {
    render(
      <PasswordLoginForm
        signupHref="/signup"
        emailCodeHref="/login?method=email-code"
      />
    );
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/signup"
    );
    expect(screen.getByTestId("email-code-link")).toBeInTheDocument();
  });
});
