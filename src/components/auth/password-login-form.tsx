"use client";

/**
 * Shared user-name / email + password sign-in form.
 *
 * Used by the tenant `/login` page and the platform `/super-admin/login` page.
 * Signs in through the NextAuth credentials provider `password`; the optional
 * second step (6-digit code emailed after a correct password) is verified on
 * the server inside `authorize`, never trusted from the browser.
 */
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import {
  PASSWORD_PROVIDER_ID,
  resolvePostSignInPath,
  SIGN_IN_CODES,
} from "@/lib/auth/sign-in-codes";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { getSession, signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

export interface PasswordLoginFormProps {
  callbackUrl?: string;
  variant?: "tenant" | "platform";
  title?: string;
  subtitle?: string;
  /** Tenant only: show the "email me a sign-in code" link (setting-gated). */
  emailCodeHref?: string | null;
  /** Tenant only: show the sign-up link (self sign-up open). */
  signupHref?: string | null;
}

type Step = "credentials" | "otp";

const OTP_LENGTH = 6;
const OTP_SLOT_CLASS =
  "h-10 w-full rounded-md border text-[0.9375rem] font-medium shadow-none data-[active=true]:border-primary data-[active=true]:ring-primary/20";

function errorKeyFor(code: string | undefined): string {
  switch (code) {
    case SIGN_IN_CODES.otpInvalid:
      return "errors.otpInvalid";
    case SIGN_IN_CODES.otpDeliveryFailed:
      return "errors.otpDeliveryFailed";
    case SIGN_IN_CODES.locked:
      return "errors.locked";
    case SIGN_IN_CODES.ssoRequired:
      return "errors.ssoRequired";
    default:
      return "errors.invalid";
  }
}

export function PasswordLoginForm({
  callbackUrl,
  variant = "tenant",
  title,
  subtitle,
  emailCodeHref,
  signupHref,
}: PasswordLoginFormProps) {
  const t = useTranslations("auth.passwordLogin");
  // Uncontrolled inputs: text typed before hydration is kept; the values are
  // remembered here for the second (code) step.
  const credentials = useRef({ identifier: "", password: "" });
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<Step>("credentials");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const isPlatform = variant === "platform";

  async function attempt(withOtp: boolean) {
    setPending(true);
    setError(null);
    try {
      const result = await signIn(PASSWORD_PROVIDER_ID, {
        identifier: credentials.current.identifier,
        password: credentials.current.password,
        ...(withOtp ? { otp } : {}),
        audience: variant,
        redirect: false,
      });
      if (result?.ok && !result.error) {
        const session = await getSession();
        window.location.assign(
          resolvePostSignInPath(session?.user, { callbackUrl, variant })
        );
        return;
      }
      if (result?.code === SIGN_IN_CODES.otpRequired) {
        setStep("otp");
        setOtp("");
        setNotice(withOtp ? t("otp.resent") : t("otp.sent"));
        return;
      }
      setError(t(errorKeyFor(result?.code)));
      if (result?.code === SIGN_IN_CODES.otpInvalid) setOtp("");
    } catch {
      setError(t("errors.default"));
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (step === "otp") {
      if (otp.length === OTP_LENGTH) void attempt(true);
      return;
    }
    const data = new FormData(event.currentTarget);
    const identifier = String(data.get("identifier") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!identifier || !password) {
      setError(t("errors.invalid"));
      return;
    }
    credentials.current = { identifier, password };
    void attempt(false);
  }

  function resetToCredentials() {
    setStep("credentials");
    setOtp("");
    credentials.current = { identifier: "", password: "" };
    setNotice(null);
    setError(null);
  }

  return (
    <div className="flex w-full flex-col gap-5" data-testid="password-login">
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-2xl font-medium">
          {title ?? (isPlatform ? t("platformTitle") : t("title"))}
        </h2>
        <p className="text-muted-foreground text-[0.9375rem]">
          {subtitle ?? (isPlatform ? t("platformSubtitle") : t("subtitle"))}
        </p>
      </div>

      {error && (
        <Alert variant="destructive" data-testid="password-login-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-5"
        data-testid="password-login-form"
        method="post"
        noValidate
      >
        {step === "credentials" ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="identifier">{t("identifier")}</Label>
              <Input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={t("identifierPlaceholder")}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex min-h-5 items-center justify-between gap-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Link
                  href="/forgot-password"
                  className="text-primary shrink-0 text-[0.8125rem] hover:underline"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder={t("passwordPlaceholder")}
                  className="pr-11"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground absolute top-1/2 right-1.5 -translate-y-1/2"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword ? t("hidePassword") : t("showPassword")
                  }
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={pending || !hydrated}
            >
              {pending ? t("signingIn") : t("submit")}
            </Button>
          </>
        ) : (
          <OtpStep
            otp={otp}
            onChange={setOtp}
            notice={notice}
            pending={pending}
            onResend={() => void attempt(false)}
            onBack={resetToCredentials}
          />
        )}
      </form>

      {!isPlatform &&
        step === "credentials" &&
        (emailCodeHref || signupHref) && (
          <div className="flex flex-col gap-3 text-center text-[0.9375rem]">
            {emailCodeHref && (
              <Link
                href={emailCodeHref}
                className="text-primary hover:underline"
                data-testid="email-code-link"
              >
                {t("emailCodeLink")}
              </Link>
            )}
            {signupHref && (
              <p className="text-foreground/80">
                {t("noAccount")}{" "}
                <Link
                  href={signupHref}
                  className="text-primary hover:underline"
                >
                  {t("signUp")}
                </Link>
              </p>
            )}
          </div>
        )}
    </div>
  );
}

function OtpStep({
  otp,
  onChange,
  notice,
  pending,
  onResend,
  onBack,
}: {
  otp: string;
  onChange: (value: string) => void;
  notice: string | null;
  pending: boolean;
  onResend: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("auth.passwordLogin");
  const slots = Array.from({ length: OTP_LENGTH }, (_, i) => i);
  return (
    <div
      className="flex flex-col gap-5"
      style={{ animation: "auth-fade-up 0.35s ease-out both" }}
      data-testid="otp-section"
    >
      {notice && (
        <div className="tonal-info flex items-start gap-2.5 rounded-md p-3 text-[0.875rem]">
          <MailCheck className="mt-0.5 size-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label>{t("otp.label")}</Label>
        <InputOTP
          maxLength={OTP_LENGTH}
          value={otp}
          onChange={onChange}
          className="w-full"
          containerClassName="w-full gap-2"
          autoFocus
          aria-label={t("otp.label")}
        >
          {slots.map((i) => (
            <SlotGroup key={i} index={i} />
          ))}
        </InputOTP>
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={pending || otp.length !== OTP_LENGTH}
      >
        {pending ? t("signingIn") : t("otp.submit")}
      </Button>
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="link"
          size="sm"
          className="text-primary h-auto px-0 py-0 text-[0.8125rem]"
          onClick={onBack}
        >
          {t("otp.back")}
        </Button>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="text-primary h-auto px-0 py-0 text-[0.8125rem]"
          onClick={onResend}
          disabled={pending}
        >
          {t("otp.resend")}
        </Button>
      </div>
    </div>
  );
}

function SlotGroup({ index }: { index: number }) {
  return (
    <>
      {index === OTP_LENGTH / 2 && (
        <InputOTPSeparator className="text-muted-foreground shrink-0 [&_svg]:size-4" />
      )}
      <InputOTPGroup className="min-w-0 flex-1">
        <InputOTPSlot index={index} className={OTP_SLOT_CLASS} />
      </InputOTPGroup>
    </>
  );
}
