"use client";

import { sendOtp } from "@/actions/otp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type OtpState = "idle" | "sending" | "sent";

/** Materio-sized OTP cell: 40px tall, full-radius box, primary focus ring. */
const OTP_SLOT_CLASS =
  "h-10 w-full rounded-md border text-[0.9375rem] font-medium shadow-none data-[active=true]:border-primary data-[active=true]:ring-primary/20";

/** Translation strings injected by the parent Server Component */
export interface LoginFormTranslations {
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
  errors: {
    userNotFound: string;
    cooldownActive: string;
    emailSendFailed: string;
    default: string;
  };
}

export interface LoginFormProps {
  /** Server Action — handles credentials sign-in */
  action: (formData: FormData) => void;
  translations: LoginFormTranslations;
}

/**
 * Submit button — detects the pending state via useFormStatus.
 * useFormStatus must be called from a child component of <form>.
 */
function SubmitButton({
  label,
  pendingLabel,
  disabled,
}: {
  label: string;
  pendingLabel: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} className="w-full">
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * Login form component (email/OTP)
 *
 * Step 1: email input + send verification code button
 * Step 2: OTP input + resend + log in button (fade-in)
 */
export function LoginForm({ action, translations: t }: LoginFormProps) {
  const [otpState, setOtpState] = useState<OtpState>("idle");
  const [otpValue, setOtpValue] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendOtp = async () => {
    const email = emailRef.current?.value ?? "";
    if (!email) return;

    setOtpState("sending");
    setError(null);

    const result = await sendOtp(email);

    if (result.success) {
      setOtpState("sent");
      setCooldown(60);
    } else {
      setOtpState("idle");
      const errorMap: Record<string, string> = {
        USER_NOT_FOUND: t.errors.userNotFound,
        COOLDOWN_ACTIVE: t.errors.cooldownActive,
        EMAIL_SEND_FAILED: t.errors.emailSendFailed,
      };
      setError(
        result.error
          ? (errorMap[result.error] ?? t.errors.default)
          : t.errors.default
      );
    }
  };

  const handleChangeEmail = () => {
    setOtpState("idle");
    setOtpValue("");
    setError(null);
    setCooldown(0);
  };

  const isSending = otpState === "sending";
  const isSent = otpState === "sent";
  const emailDisabled = isSent || isSending;
  const isOtpSectionVisible = isSent;
  const canSubmit = otpValue.length === 6 && isSent;

  const resendButtonLabel =
    cooldown > 0
      ? t.resendCooldown.replace("{seconds}", String(cooldown))
      : t.resendOtp;
  const resendButtonDisabled = isSending || cooldown > 0;

  return (
    <form
      action={action}
      className="flex flex-col gap-5"
      data-testid="login-credentials-form"
    >
      {/* Email + send/change buttons */}
      <div className="flex flex-col gap-1.5">
        <div className="flex min-h-5 items-center justify-between gap-2">
          <Label htmlFor="email">{t.email}</Label>
          {isOtpSectionVisible && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={handleChangeEmail}
              className="text-primary h-auto shrink-0 px-0 py-0 text-[0.8125rem]"
              data-testid="change-email-btn"
            >
              {t.changeEmail}
            </Button>
          )}
        </div>
        <Input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          placeholder={t.emailPlaceholder}
          autoComplete="email"
          required
          readOnly={emailDisabled}
          tabIndex={emailDisabled ? -1 : undefined}
          className={emailDisabled ? "bg-muted pointer-events-none" : ""}
        />
      </div>

      {!isOtpSectionVisible && (
        <Button
          type="button"
          onClick={handleSendOtp}
          disabled={isSending}
          className="w-full"
        >
          {isSending ? t.sendingOtp : t.sendOtp}
        </Button>
      )}

      {/* Step 1 error */}
      {!isOtpSectionVisible && error && (
        <p className="text-destructive text-[0.8125rem]" role="alert">
          {error}
        </p>
      )}

      {/* Step 2: OTP section + log in button */}
      {isOtpSectionVisible && (
        <>
          <div
            className="flex flex-col gap-1.5"
            style={{ animation: "auth-fade-up 0.35s ease-out both" }}
            data-testid="otp-section"
          >
            <Label>{t.otpLabel}</Label>
            <InputOTP
              maxLength={6}
              value={otpValue}
              onChange={setOtpValue}
              className="w-full"
              containerClassName="w-full gap-2"
            >
              <InputOTPGroup className="min-w-0 flex-1">
                <InputOTPSlot index={0} className={OTP_SLOT_CLASS} />
              </InputOTPGroup>
              <InputOTPGroup className="min-w-0 flex-1">
                <InputOTPSlot index={1} className={OTP_SLOT_CLASS} />
              </InputOTPGroup>
              <InputOTPGroup className="min-w-0 flex-1">
                <InputOTPSlot index={2} className={OTP_SLOT_CLASS} />
              </InputOTPGroup>
              <InputOTPSeparator className="text-muted-foreground shrink-0 [&_svg]:size-4" />
              <InputOTPGroup className="min-w-0 flex-1">
                <InputOTPSlot index={3} className={OTP_SLOT_CLASS} />
              </InputOTPGroup>
              <InputOTPGroup className="min-w-0 flex-1">
                <InputOTPSlot index={4} className={OTP_SLOT_CLASS} />
              </InputOTPGroup>
              <InputOTPGroup className="min-w-0 flex-1">
                <InputOTPSlot index={5} className={OTP_SLOT_CLASS} />
              </InputOTPGroup>
            </InputOTP>
            <input type="hidden" name="otp" value={otpValue} />

            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={handleSendOtp}
              disabled={resendButtonDisabled}
              className="text-primary disabled:text-muted-foreground h-auto self-start px-0 py-0 text-[0.8125rem] whitespace-nowrap"
            >
              {resendButtonLabel}
            </Button>
          </div>

          {error && (
            <p className="text-destructive text-[0.8125rem]" role="alert">
              {error}
            </p>
          )}

          <div style={{ animation: "auth-fade-up 0.35s ease-out 0.05s both" }}>
            <SubmitButton
              label={t.submit}
              pendingLabel={t.signingIn}
              disabled={!canSubmit}
            />
          </div>
        </>
      )}
    </form>
  );
}
