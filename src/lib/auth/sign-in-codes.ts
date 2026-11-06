// src/lib/auth/sign-in-codes.ts
/**
 * Error codes the `password` credentials provider returns to the browser
 * (`signIn(...)` → `{ code }`). Shared by the server (`authorize`) and the
 * client form, so it must stay free of server-only imports.
 */
export const SIGN_IN_CODES = {
  /** Wrong identifier or password — deliberately generic. */
  invalid: "invalid_credentials",
  /** Password accepted; a 6-digit code was emailed and must be entered. */
  otpRequired: "otp_required",
  /** The emailed code was wrong, expired or used up. */
  otpInvalid: "otp_invalid",
  /** The code could not be emailed (no delivery configured / provider down). */
  otpDeliveryFailed: "otp_delivery_failed",
  /** Too many failed attempts; the account is temporarily locked. */
  locked: "account_locked",
  /** Password sign-in is disabled for this organisation (SSO enforced). */
  ssoRequired: "sso_required",
} as const;

export type SignInCode = (typeof SIGN_IN_CODES)[keyof typeof SIGN_IN_CODES];

/** Credentials provider ids. */
export const PASSWORD_PROVIDER_ID = "password";
export const EMAIL_CODE_PROVIDER_ID = "credentials";

/** Where a signed-in user must go while a password change is pending. */
export const CHANGE_PASSWORD_PATH = "/change-password";

/**
 * Accept only same-origin relative paths as a post-login destination
 * (blocks `//evil.com` and absolute URLs).
 */
export function safeCallbackUrl(
  url: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!url || !url.startsWith("/") || url.startsWith("//")) return fallback;
  if (url.startsWith("/\\")) return fallback;
  return url;
}

export interface PostSignInUser {
  role?: string | null;
  organizationId?: string | null;
  mustChangePassword?: boolean | null;
}

/** Decide where to send a user right after a successful sign-in. */
export function resolvePostSignInPath(
  user: PostSignInUser | null | undefined,
  options: { callbackUrl?: string; variant?: "tenant" | "platform" } = {}
): string {
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const fallback =
    options.variant === "platform" || isSuperAdmin
      ? "/super-admin"
      : "/dashboard";
  let target = safeCallbackUrl(options.callbackUrl, fallback);
  // Platform administrators never land in the tenant workspace, and tenant
  // users never land in the platform console.
  if (isSuperAdmin && !target.startsWith("/super-admin"))
    target = "/super-admin";
  if (!isSuperAdmin && target.startsWith("/super-admin")) target = "/dashboard";
  if (user?.mustChangePassword) {
    return `${CHANGE_PASSWORD_PATH}?callbackUrl=${encodeURIComponent(target)}`;
  }
  return target;
}
