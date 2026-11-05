// src/app/(dashboard)/org/sync/page.tsx

import { OrgLayout } from "@/components/org/org-layout";
import { OrgSyncForm } from "@/components/org/org-sync-form";
import { requireAdmin } from "@/lib/auth/require-auth";

export async function generateMetadata() {
  return {
    title: "Org & User Sync",
    description:
      "Sync your organization structure and users via CSV files or external systems",
  };
}

export default async function OrgSyncPage() {
  await requireAdmin("/dashboard");

  return (
    <OrgLayout>
      <OrgSyncForm />
    </OrgLayout>
  );
}
