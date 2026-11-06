// src/app/(dashboard)/integrations/[id]/page.tsx
import { IntegrationDetailClient } from "@/components/integrations/integration-detail-client";
import { requireOrganization } from "@/lib/auth/require-auth";
import { can, requirePermissionOrRedirect } from "@/lib/rbac/service";

interface IntegrationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function IntegrationDetailPage({
  params,
}: IntegrationDetailPageProps) {
  await requireOrganization();
  await requirePermissionOrRedirect("integrations:read");
  const { id } = await params;
  const canManage = await can("integrations:manage");
  return <IntegrationDetailClient id={id} canManage={canManage} />;
}
