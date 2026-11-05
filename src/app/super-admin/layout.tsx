// src/app/(super-admin)/layout.tsx
import { ClientProviders } from "@/components/providers/client-providers";
import { SuperAdminSidebar } from "@/components/super-admin/super-admin-sidebar";
import { requireSuperAdmin } from "@/lib/auth/require-auth";
import { getDeploymentInfo } from "@/lib/deployment/mode";
import { Suspense } from "react";

/**
 * Super Admin layout
 * Redirects to /dashboard without the SUPER_ADMIN role
 */
export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdmin();

  return (
    <ClientProviders>
      <div className="bg-background flex min-h-screen flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
        <Suspense>
          <SuperAdminSidebar deployment={getDeploymentInfo()} />
        </Suspense>
        <main className="bg-background min-w-0 flex-1 lg:overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6">
            {children}
          </div>
        </main>
      </div>
    </ClientProviders>
  );
}
