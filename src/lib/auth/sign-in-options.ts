// src/lib/auth/sign-in-options.ts
/**
 * Pre-authentication sign-in options for the login/signup pages.
 *
 * `security.enforceSso` is organisation-scoped but no organisation is known before
 * sign-in:
 *   - single-tenant: the installation's only organisation decides;
 *   - SaaS: the organisation of the invitation / claimed domain when the caller
 *     knows it (`context.organizationId`), otherwise the platform (system) value.
 *     Never "the first organisation" — that would leak one tenant's policy to all.
 */
import {
  getSingleTenantOrganization,
  isSignupOpen,
} from "@/lib/deployment/tenancy";
import { getSetting, getSystemSetting } from "@/lib/settings/service";
import { isAppleSignInEnabled } from "./index";

export interface SignInOptions {
  appleEnabled: boolean;
  /** Password sign-in hidden: SSO enforced AND an SSO provider is configured. */
  enforceSso: boolean;
  allowSelfSignup: boolean;
  /** Passwordless "email me a code" sign-in (security.allowEmailCodeSignIn). */
  emailCodeEnabled: boolean;
}

export interface SignInContext {
  /** Organisation known before sign-in (invitation, claimed email domain). */
  organizationId?: string | null;
}

async function resolveOrganizationId(
  context: SignInContext
): Promise<string | null> {
  if (context.organizationId) return context.organizationId;
  const sole = await getSingleTenantOrganization();
  return sole?.id ?? null;
}

export async function getSignInOptions(
  context: SignInContext = {}
): Promise<SignInOptions> {
  const organizationId = await resolveOrganizationId(context);
  const [enforceSso, allowSelfSignup, emailCodeEnabled] = await Promise.all([
    organizationId
      ? getSetting(organizationId, "security.enforceSso")
      : getSystemSetting("security.enforceSso"),
    isSignupOpen(),
    organizationId
      ? getSetting(organizationId, "security.allowEmailCodeSignIn")
      : getSystemSetting("security.allowEmailCodeSignIn"),
  ]);
  const appleEnabled = isAppleSignInEnabled();
  return {
    appleEnabled,
    // Without a configured SSO provider, enforcing it would lock everyone out.
    enforceSso: enforceSso && appleEnabled,
    allowSelfSignup,
    emailCodeEnabled,
  };
}
