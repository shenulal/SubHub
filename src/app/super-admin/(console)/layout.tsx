// src/app/super-admin/(console)/layout.tsx
/**
 * Guarded Control Panel shell. Only an active platform super admin (SUPER_ADMIN
 * without an organisation) gets in: no session → /super-admin/login; tenant
 * users (tenant ADMIN too) and disabled operators → 403. Actions re-check.
 */
import { PlatformAccessDenied } from "@/components/super-admin/shell/platform-access-denied";
import { PlatformShell } from "@/components/super-admin/shell/platform-shell";
import { CHANGE_PASSWORD_PATH } from "@/lib/auth/sign-in-codes";
import { getDeploymentInfo } from "@/lib/deployment/mode";
import { getPlatformAccess } from "@/lib/platform/guard";
import {
  PLATFORM_HOME_PATH,
  PLATFORM_LOGIN_PATH,
} from "@/lib/platform/identity";
import { redirect } from "next/navigation";

export default async function ControlPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getPlatformAccess();
  if (access.status === "unauthenticated") redirect(PLATFORM_LOGIN_PATH);
  if (access.status === "password_change") {
    redirect(
      `${CHANGE_PASSWORD_PATH}?callbackUrl=${encodeURIComponent(PLATFORM_HOME_PATH)}`
    );
  }
  if (access.status !== "ok")
    return <PlatformAccessDenied reason={access.status} />;

  return (
    <PlatformShell
      deployment={getDeploymentInfo()}
      operator={{ name: access.actor.name, email: access.actor.email }}
    >
      {children}
    </PlatformShell>
  );
}
