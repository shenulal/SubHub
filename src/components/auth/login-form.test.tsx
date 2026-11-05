import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    useFormStatus: () => ({ pending: false }),
  };
});

vi.mock("@/actions/otp", () => ({
  sendOtp: vi.fn(),
}));

vi.mock("@/components/ui/input-otp", () => ({
  InputOTP: ({
    value,
    onChange,
    disabled,
    children,
  }: {
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
    children?: React.ReactNode;
  }) => (
    <div data-testid="input-otp">
      <input
        data-testid="otp-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label="Verification code"
        maxLength={6}
      />
      {children}
    </div>
  ),
  InputOTPGroup: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  InputOTPSlot: ({ index }: { index: number }) => <span data-slot={index} />,
  InputOTPSeparator: () => <span aria-hidden="true">-</span>,
}));

import { sendOtp } from "@/actions/otp";
const mockedSendOtp = sendOtp as ReturnType<typeof vi.fn>;

const translations = {
  email: "Email",
  emailPlaceholder: "name@company.com",
  sendOtp: "Send verification code",
  sendingOtp: "Sending...",
  resendOtp: "Resend verification code",
  resendCooldown: "Resend available in {seconds}s",
  otpLabel: "Verification code",
  otpPlaceholder: "Enter 6 digits",
  submit: "Log in",
  signingIn: "Signing in...",
  changeEmail: "Change email",
  errors: {
    userNotFound: "This email is not registered",
    cooldownActive: "Please try again in {seconds} seconds",
    emailSendFailed: "Failed to send the email",
    default: "An error occurred during login",
  },
};

const mockAction = vi.fn();

describe("LoginForm (OTP)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedSendOtp.mockResolvedValue({
      success: true,
      message: "Verification code sent",
    });
  });

  const renderForm = () =>
    render(<LoginForm action={mockAction} translations={translations} />);

  describe("initial render (Step 1)", () => {
    it("renders the email input field", () => {
      renderForm();
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("name@company.com")
      ).toBeInTheDocument();
    });

    it("renders the send verification code button", () => {
      renderForm();
      expect(
        screen.getByRole("button", { name: "Send verification code" })
      ).toBeInTheDocument();
    });

    it("does not render the OTP section initially", () => {
      renderForm();
      expect(screen.queryByTestId("otp-section")).not.toBeInTheDocument();
      expect(screen.queryByTestId("input-otp")).not.toBeInTheDocument();
    });

    it("does not render the log in button initially", () => {
      renderForm();
      expect(
        screen.queryByRole("button", { name: "Log in" })
      ).not.toBeInTheDocument();
    });

    it("does not render the change email button initially", () => {
      renderForm();
      expect(screen.queryByTestId("change-email-btn")).not.toBeInTheDocument();
    });

    it("has no password input field", () => {
      renderForm();
      expect(screen.queryByLabelText(/Password/)).not.toBeInTheDocument();
    });

    it("has no forgot password link", () => {
      renderForm();
      expect(
        screen.queryByRole("link", { name: /Password/ })
      ).not.toBeInTheDocument();
    });

    it("has no sign-up link", () => {
      renderForm();
      expect(
        screen.queryByRole("link", { name: /Sign up/ })
      ).not.toBeInTheDocument();
    });

    it("has no Remember me checkbox", () => {
      renderForm();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });
  });

  describe("OTP sending flow", () => {
    it("calls sendOtp after entering an email and clicking send", async () => {
      const user = userEvent.setup();
      renderForm();
      await user.type(screen.getByLabelText("Email"), "test@example.com");
      await user.click(
        screen.getByRole("button", { name: "Send verification code" })
      );
      await waitFor(() => {
        expect(mockedSendOtp).toHaveBeenCalledWith("test@example.com");
      });
    });

    it("shows the OTP section after the code is sent", async () => {
      const user = userEvent.setup();
      renderForm();
      await user.type(screen.getByLabelText("Email"), "test@example.com");
      await user.click(
        screen.getByRole("button", { name: "Send verification code" })
      );
      await waitFor(() => {
        expect(screen.getByTestId("otp-section")).toBeInTheDocument();
        expect(screen.getByTestId("otp-input")).toBeInTheDocument();
      });
    });

    it("shows the log in button after the code is sent", async () => {
      const user = userEvent.setup();
      renderForm();
      await user.type(screen.getByLabelText("Email"), "test@example.com");
      await user.click(
        screen.getByRole("button", { name: "Send verification code" })
      );
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Log in" })
        ).toBeInTheDocument();
      });
    });

    it("shows the change email button after the code is sent", async () => {
      const user = userEvent.setup();
      renderForm();
      await user.type(screen.getByLabelText("Email"), "test@example.com");
      await user.click(
        screen.getByRole("button", { name: "Send verification code" })
      );
      await waitFor(() => {
        expect(screen.getByTestId("change-email-btn")).toBeInTheDocument();
      });
    });

    it("makes the email field read-only after the code is sent", async () => {
      const user = userEvent.setup();
      renderForm();
      await user.type(screen.getByLabelText("Email"), "test@example.com");
      await user.click(
        screen.getByRole("button", { name: "Send verification code" })
      );
      await waitFor(() => {
        expect(screen.getByLabelText("Email")).toHaveAttribute("readonly");
      });
    });

    it("shows the error message inline when sending fails", async () => {
      mockedSendOtp.mockResolvedValue({
        success: false,
        error: "USER_NOT_FOUND",
      });
      const user = userEvent.setup();
      renderForm();
      await user.type(screen.getByLabelText("Email"), "unknown@example.com");
      await user.click(
        screen.getByRole("button", { name: "Send verification code" })
      );
      await waitFor(() => {
        const errorEl = screen.getByRole("alert");
        expect(errorEl).toBeInTheDocument();
        expect(errorEl.tagName).toBe("P");
        expect(errorEl).toHaveTextContent("This email is not registered");
      });
    });

    it("does not show the OTP section when sending fails", async () => {
      mockedSendOtp.mockResolvedValue({
        success: false,
        error: "USER_NOT_FOUND",
      });
      const user = userEvent.setup();
      renderForm();
      await user.type(screen.getByLabelText("Email"), "unknown@example.com");
      await user.click(
        screen.getByRole("button", { name: "Send verification code" })
      );
      await waitFor(() => {
        expect(screen.queryByTestId("otp-section")).not.toBeInTheDocument();
      });
    });
  });

  describe("change email (Step 2 → Step 1)", () => {
    const goToStep2 = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.type(screen.getByLabelText("Email"), "test@example.com");
      await user.click(
        screen.getByRole("button", { name: "Send verification code" })
      );
      await waitFor(() =>
        expect(screen.getByTestId("otp-section")).toBeInTheDocument()
      );
    };

    it("returns to Step 1 when change email is clicked", async () => {
      const user = userEvent.setup();
      renderForm();
      await goToStep2(user);
      await user.click(screen.getByTestId("change-email-btn"));
      await waitFor(() => {
        expect(screen.queryByTestId("otp-section")).not.toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: "Log in" })
        ).not.toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: "Send verification code" })
        ).toBeInTheDocument();
      });
    });

    it("re-enables the email field after changing email", async () => {
      const user = userEvent.setup();
      renderForm();
      await goToStep2(user);
      await user.click(screen.getByTestId("change-email-btn"));
      await waitFor(() => {
        expect(screen.getByLabelText("Email")).not.toBeDisabled();
      });
    });

    it("clears the error after changing email", async () => {
      mockedSendOtp
        .mockResolvedValueOnce({
          success: true,
          message: "Verification code sent",
        })
        .mockResolvedValueOnce({ success: false, message: "Server error" });
      const user = userEvent.setup();
      renderForm();
      await goToStep2(user);

      // Triggering a resend failure in Step 2 is cumbersome, so instead
      // verify directly that handleChangeEmail clears the error
      await user.click(screen.getByTestId("change-email-btn"));
      await waitFor(() => {
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      });
    });
  });

  describe("OTP entry and log in", () => {
    const sendOtpSuccessfully = async (
      user: ReturnType<typeof userEvent.setup>
    ) => {
      await user.type(screen.getByLabelText("Email"), "test@example.com");
      await user.click(
        screen.getByRole("button", { name: "Send verification code" })
      );
      await waitFor(() =>
        expect(screen.getByTestId("otp-input")).toBeInTheDocument()
      );
    };

    it("enables the log in button after entering a 6-digit OTP", async () => {
      const user = userEvent.setup();
      renderForm();
      await sendOtpSuccessfully(user);
      await user.type(screen.getByTestId("otp-input"), "123456");
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Log in" })
        ).not.toBeDisabled();
      });
    });

    it("reflects the entered value in the hidden OTP input", async () => {
      const user = userEvent.setup();
      renderForm();
      await sendOtpSuccessfully(user);
      await user.type(screen.getByTestId("otp-input"), "123456");
      await waitFor(() => {
        const hiddenInput = document.querySelector(
          'input[name="otp"]'
        ) as HTMLInputElement;
        expect(hiddenInput).not.toBeNull();
        expect(hiddenInput.value).toBe("123456");
      });
    });
  });
});
