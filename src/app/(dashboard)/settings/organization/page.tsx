// src/app/(dashboard)/settings/organization/page.tsx
import { OrganizationTabs } from "@/components/settings/organization-tabs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Organization",
  description: "Manage organization information",
};

export default async function OrganizationSettingsPage() {
  await requirePermissionOrRedirect("organization:manage", "/settings");
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }
  if (!session.user.organizationId) {
    redirect("/onboarding");
  }

  const organization = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      name: true,
      domain: true,
      logoUrl: true,
      settings: true,
    },
  });

  if (!organization) {
    redirect("/onboarding");
  }

  return (
    <OrganizationTabs
      organization={{
        name: organization.name,
        domain: organization.domain,
        logoUrl: organization.logoUrl,
        settings: organization.settings as Record<string, unknown> | null,
      }}
    />
  );
}
