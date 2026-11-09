// src/app/(dashboard)/(org)/users/page.tsx
import { UserPageClient } from "@/components/users/user-page-client";
import { getCachedSession } from "@/lib/auth/require-auth";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";

export default async function UsersPage() {
  await requirePermissionOrRedirect("members:read", "/dashboard");
  const session = await getCachedSession();
  const role = session?.user?.role ?? null;

  return (
    <UserPageClient
      role={role as "ADMIN" | "APPROVER" | "MEMBER" | "VIEWER" | null}
    />
  );
}
