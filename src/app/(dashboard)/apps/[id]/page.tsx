// src/app/(dashboard)/apps/[id]/page.tsx
import { AppDetailClient } from "@/components/apps/app-detail-client";
import { getCachedSession } from "@/lib/auth/require-auth";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";

interface AppDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AppDetailPage({ params }: AppDetailPageProps) {
  await requirePermissionOrRedirect("apps:read", "/dashboard");
  const { id } = await params;
  const session = await getCachedSession();
  const role = session?.user?.role ?? null;
  return (
    <AppDetailClient
      id={id}
      role={role as "ADMIN" | "APPROVER" | "MEMBER" | "VIEWER" | null}
    />
  );
}
