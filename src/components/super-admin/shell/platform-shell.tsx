// src/components/super-admin/shell/platform-shell.tsx
/** Control Panel frame: dark platform sidebar + content column (no tenant chrome). */
import type { DeploymentInfo } from "@/lib/deployment/mode";
import { Suspense } from "react";
import { PlatformSidebar, type PlatformOperator } from "./platform-sidebar";

export function PlatformShell({
  deployment,
  operator,
  children,
}: {
  deployment: DeploymentInfo;
  operator: PlatformOperator;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid="platform-shell"
      className="bg-background flex min-h-screen flex-col lg:h-screen lg:flex-row lg:overflow-hidden"
    >
      <Suspense>
        <PlatformSidebar deployment={deployment} operator={operator} />
      </Suspense>
      <main className="bg-background min-w-0 flex-1 lg:overflow-y-auto">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
