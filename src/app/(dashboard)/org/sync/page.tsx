// src/app/(dashboard)/org/sync/page.tsx

import { OrgLayout } from "@/components/org/org-layout";
import { OrgSyncForm } from "@/components/org/org-sync-form";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";

export async function generateMetadata() {
  return {
    title: "Org & User Sync",
    description:
      "Sync your organization structure and users via CSV files or external systems",
  };
}

export default async function OrgSyncPage() {
  await requirePermissionOrRedirect(
    ["teams:manage", "members:manage"],
    "/teams"
  );

  return (
    <OrgLayout>
      <OrgSyncForm />
    </OrgLayout>
  );
}
