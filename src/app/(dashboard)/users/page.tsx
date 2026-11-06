// src/app/(dashboard)/users/page.tsx
import { OrgLayout } from "@/components/org/org-layout";
import { UserPageClient } from "@/components/users/user-page-client";
import { getCachedSession } from "@/lib/auth/require-auth";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";

export default async function UsersPage() {
  await requirePermissionOrRedirect("members:read", "/dashboard");
  const session = await getCachedSession();
  const role = session?.user?.role ?? null;

  return (
    <OrgLayout>
      <UserPageClient
        role={role as "ADMIN" | "APPROVER" | "MEMBER" | "VIEWER" | null}
      />
    </OrgLayout>
  );
}
