// src/app/(dashboard)/settings/roles/page.tsx
import { getRolesPage } from "@/actions/platform/roles";
import { RolesPageClient } from "@/components/platform/roles/roles-page-client";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Roles & permissions" };

export default async function RolesSettingsPage() {
  await requirePermissionOrRedirect("roles:manage", "/settings");
  const result = await getRolesPage();
  if (!result.success || !result.data) {
    return <p className="text-destructive text-sm">{result.error}</p>;
  }
  return <RolesPageClient payload={result.data} />;
}
