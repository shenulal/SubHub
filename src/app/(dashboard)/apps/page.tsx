// src/app/(dashboard)/apps/page.tsx
import { AppsPageClient } from "@/components/apps/apps-page-client";
import { getCachedSession } from "@/lib/auth/require-auth";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";

export default async function AppsPage() {
  await requirePermissionOrRedirect("apps:read", "/dashboard");
  const session = await getCachedSession();
  const role = session?.user?.role ?? null;

  return (
    <AppsPageClient
      role={role as "ADMIN" | "APPROVER" | "MEMBER" | "VIEWER" | null}
    />
  );
}
