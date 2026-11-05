// src/app/(dashboard)/integrations/page.tsx
import { IntegrationsPageClient } from "@/components/integrations/integrations-page-client";
import { requireOrganization, type UserRole } from "@/lib/auth/require-auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Manage SSO/IdP integrations",
};

export default async function IntegrationsPage() {
  const { role } = await requireOrganization();

  const canManage = role === "ADMIN";

  return (
    <IntegrationsPageClient canManage={canManage} role={role as UserRole} />
  );
}
