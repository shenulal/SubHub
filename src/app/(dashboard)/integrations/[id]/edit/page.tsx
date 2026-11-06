// src/app/(dashboard)/integrations/[id]/edit/page.tsx
import { IntegrationEditClient } from "@/components/integrations/integration-edit-client";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";

interface IntegrationEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function IntegrationEditPage({
  params,
}: IntegrationEditPageProps) {
  await requirePermissionOrRedirect("integrations:manage", "/integrations");
  const { id } = await params;
  return <IntegrationEditClient id={id} />;
}
