// src/actions/otp-dev.ts
// Local / QA OTP delivery fallback. A fixed code (AUTH_DEV_OTP) is honoured in
// development, or in a production build that is served on localhost (local
// preview). A deployed environment never has a localhost NEXTAUTH_URL, so the
// fixed code is never accepted there.

const DEV_OTP_PATTERN = /^\d{6}$/;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export interface DevOtpEnv {
  NODE_ENV?: string;
  AUTH_DEV_OTP?: string;
  RESEND_API_KEY?: string;
  NEXTAUTH_URL?: string;
}

/** True when the configured app URL points at this machine. */
export function isLocalAppUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

function isLocalEnvironment(env: DevOtpEnv): boolean {
  return env.NODE_ENV !== "production" || isLocalAppUrl(env.NEXTAUTH_URL);
}

/** Fixed sign-in code for local/QA environments, or null when not allowed. */
export function getDevOtpOverride(env: DevOtpEnv = process.env): string | null {
  if (!isLocalEnvironment(env)) return null;
  const code = env.AUTH_DEV_OTP?.trim();
  if (!code || !DEV_OTP_PATTERN.test(code)) return null;
  return code;
}

/** True when no email provider is configured in a local environment, so the
 *  code should be written to the server log instead of failing the sign-in. */
export function shouldLogOtpInsteadOfEmail(
  env: DevOtpEnv = process.env
): boolean {
  return isLocalEnvironment(env) && !env.RESEND_API_KEY;
}
