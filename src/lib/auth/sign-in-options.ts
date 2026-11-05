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
  enforceSso: boolean;
  allowSelfSignup: boolean;
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
  const [enforceSso, allowSelfSignup] = await Promise.all([
    organizationId
      ? getSetting(organizationId, "security.enforceSso")
      : getSystemSetting("security.enforceSso"),
    isSignupOpen(),
  ]);
  return { appleEnabled: isAppleSignInEnabled(), enforceSso, allowSelfSignup };
}
