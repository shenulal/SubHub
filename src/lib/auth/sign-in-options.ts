// src/lib/auth/sign-in-options.ts
/**
 * Pre-authentication sign-in options for the login/signup pages.
 * `security.enforceSso` is organisation-scoped but no organisation is known
 * before sign-in; Phase 1 is single-tenant so the first organisation's value
 * is used, falling back to the system/default value when none exists.
 */
import { prisma } from "@/lib/db";
import { getSetting, getSystemSetting } from "@/lib/settings/service";
import { isAppleSignInEnabled } from "./index";

export interface SignInOptions {
  appleEnabled: boolean;
  enforceSso: boolean;
  allowSelfSignup: boolean;
}

export async function getSignInOptions(): Promise<SignInOptions> {
  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const [enforceSso, allowSelfSignup] = await Promise.all([
    org
      ? getSetting(org.id, "security.enforceSso")
      : getSystemSetting("security.enforceSso"),
    getSystemSetting("system.allowSelfSignup"),
  ]);
  return { appleEnabled: isAppleSignInEnabled(), enforceSso, allowSelfSignup };
}
