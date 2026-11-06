// src/app/super-admin/login/page.tsx
/**
 * Control Panel sign-in — separate entry from the tenant `/login`. Uses the
 * shared `PasswordLoginForm` (credentials provider `password`) in its platform
 * variant; a signed-in, active platform admin goes straight to the panel.
 */
import { PasswordLoginForm } from "@/components/auth/password-login-form";
import { PlatformBrand } from "@/components/super-admin/shell/platform-brand";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { CHANGE_PASSWORD_PATH } from "@/lib/auth/sign-in-codes";
import { getPlatformAccess } from "@/lib/platform/guard";
import { PLATFORM_HOME_PATH } from "@/lib/platform/identity";
import { Building2, KeyRound, ScrollText, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Sign in" };

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

const HIGHLIGHTS = [
  { icon: Building2, text: "Create, suspend and support tenants" },
  { icon: ShieldCheck, text: "Manage platform and tenant administrators" },
  { icon: KeyRound, text: "Licence and installation details" },
  { icon: ScrollText, text: "Every action recorded in the platform audit log" },
];

function SidePanel() {
  return (
    <section className="dark bg-card text-foreground hidden flex-col justify-between p-10 lg:flex lg:w-[440px] xl:w-[520px]">
      <PlatformBrand />
      <div className="space-y-6">
        <h1 className="text-foreground text-3xl leading-tight font-medium">
          Platform operations for SubHub
        </h1>
        <ul className="space-y-3">
          {HIGHLIGHTS.map((h) => (
            <li
              key={h.text}
              className="text-foreground/80 flex items-center gap-3 text-[0.9375rem]"
            >
              <span className="tonal-primary flex size-8 shrink-0 items-center justify-center rounded-md">
                <h.icon className="size-4" />
              </span>
              {h.text}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-muted-foreground text-[0.8125rem]">
        © {new Date().getFullYear()} SubHub · HelloPixels
      </p>
    </section>
  );
}

export default async function PlatformLoginPage({ searchParams }: PageProps) {
  const [{ error }, access] = await Promise.all([
    searchParams,
    getPlatformAccess(),
  ]);
  if (access.status === "ok") redirect(PLATFORM_HOME_PATH);
  if (access.status === "password_change") {
    redirect(
      `${CHANGE_PASSWORD_PATH}?callbackUrl=${encodeURIComponent(PLATFORM_HOME_PATH)}`
    );
  }

  return (
    <div
      className="bg-background flex min-h-[100dvh]"
      data-testid="platform-login-page"
    >
      <SidePanel />
      <main className="flex min-w-0 flex-1 items-center justify-center p-4 sm:p-6">
        <Card className="w-full max-w-[450px]">
          <CardContent className="flex flex-col gap-5 p-6 sm:p-10">
            <PlatformBrand className="lg:hidden" />
            {(error === "disabled" || access.status === "disabled") && (
              <Alert variant="destructive">
                <AlertDescription>
                  This platform administrator account is disabled. Ask another
                  platform administrator to enable it.
                </AlertDescription>
              </Alert>
            )}
            {access.status === "forbidden" && (
              <div className="tonal-info rounded-md p-3 text-[0.875rem]">
                You are signed in to a tenant workspace. Tenant administrators
                cannot open the Control Panel; sign in with a platform
                administrator account to continue.
              </div>
            )}
            <PasswordLoginForm
              variant="platform"
              callbackUrl={PLATFORM_HOME_PATH}
              title="Control Panel sign-in"
              subtitle="For HelloPixels platform administrators only."
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
