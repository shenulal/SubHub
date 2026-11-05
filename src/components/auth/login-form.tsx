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

/** 부모 Server Component에서 주입하는 번역 문자열 */
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
  /** Server Action — credentials 로그인 처리 */
  action: (formData: FormData) => void;
  translations: LoginFormTranslations;
}

/**
 * Submit 버튼 — useFormStatus로 pending 상태를 감지합니다.
 * useFormStatus는 반드시 <form> 자식 컴포넌트에서 호출해야 합니다.
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
 * 로그인 폼 컴포넌트 (이메일/OTP)
 *
 * Step 1: 이메일 입력 + 인증 코드 발송 버튼
 * Step 2: OTP 입력 + 재발송 + 로그인 버튼 (fade-in)
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
      {/* 이메일 + 발송/변경 버튼 */}
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

      {/* Step 1 에러 */}
      {!isOtpSectionVisible && error && (
        <p className="text-destructive text-[0.8125rem]" role="alert">
          {error}
        </p>
      )}

      {/* Step 2: OTP 영역 + 로그인 버튼 */}
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
