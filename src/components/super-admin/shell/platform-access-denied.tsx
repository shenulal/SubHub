// src/components/super-admin/shell/platform-access-denied.tsx
/**
 * 403 for the Control Panel: a signed-in tenant user (tenant ADMIN included) or
 * a disabled platform admin. Never renders panel navigation.
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PlatformDenial } from "@/lib/platform/guard";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { PlatformBrand } from "./platform-brand";
import { PlatformSignOutButton } from "./platform-sign-out-button";

const COPY: Record<
  Exclude<PlatformDenial, "unauthenticated" | "password_change">,
  { title: string; body: string }
> = {
  forbidden: {
    title: "This area is for platform administrators",
    body: "The SubHub Control Panel manages tenants and the platform. Your account administers a tenant workspace, so it cannot open the Control Panel.",
  },
  disabled: {
    title: "Your platform administrator account is disabled",
    body: "Ask another platform administrator to enable it again.",
  },
};

export function PlatformAccessDenied({
  reason,
}: {
  reason: Exclude<PlatformDenial, "unauthenticated" | "password_change">;
}) {
  const copy = COPY[reason];
  return (
    <div className="bg-background flex min-h-[100dvh] items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-[480px]" data-testid="platform-forbidden">
        <CardContent className="flex flex-col gap-5 p-6 sm:p-8">
          <PlatformBrand />
          <div className="flex items-start gap-3">
            <span className="tonal-error flex size-10 shrink-0 items-center justify-center rounded-md">
              <ShieldAlert className="size-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-muted-foreground text-[0.8125rem] font-medium">
                Error 403
              </p>
              <h1 className="text-foreground text-xl font-medium">
                {copy.title}
              </h1>
              <p className="text-muted-foreground text-[0.9375rem]">
                {copy.body}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {reason === "forbidden" && (
              <Button asChild>
                <Link href="/dashboard">Back to your workspace</Link>
              </Button>
            )}
            <PlatformSignOutButton
              label="Sign in as a platform admin"
              className="border-border border"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
