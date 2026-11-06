// src/app/(dashboard)/integrations/page.tsx
import { IntegrationsPageClient } from "@/components/integrations/integrations-page-client";
import { requireOrganization, type UserRole } from "@/lib/auth/require-auth";
import { can, requirePermissionOrRedirect } from "@/lib/rbac/service";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Manage SSO/IdP integrations",
};

export default async function IntegrationsPage() {
  const { role } = await requireOrganization();
  await requirePermissionOrRedirect("integrations:read");

  const canManage = await can("integrations:manage");

  return (
    <IntegrationsPageClient canManage={canManage} role={role as UserRole} />
  );
}
