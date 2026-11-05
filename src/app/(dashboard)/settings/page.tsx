// src/app/(dashboard)/settings/page.tsx
import { SettingsPageClient } from "@/components/settings/settings-page-client";
import { requireOrganization } from "@/lib/auth/require-auth";
import { getDeploymentInfo } from "@/lib/deployment/mode";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage account and organization settings",
};

export default async function SettingsPage() {
  const { session, organizationId, userId, role } = await requireOrganization();

  return (
    <SettingsPageClient
      fallbackUser={{
        id: userId,
        email: session.user.email!,
        name: session.user.name,
        organizationId,
        role,
      }}
      deployment={getDeploymentInfo()}
    />
  );
}
