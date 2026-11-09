// src/app/(dashboard)/settings/layout.tsx
import { SectionLayout } from "@/components/layouts/section-layout";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import { requireOrganization } from "@/lib/auth/require-auth";
import { getUserPermissionSet } from "@/lib/rbac/service";
import { getTranslations } from "next-intl/server";

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default async function SettingsLayout({
  children,
}: SettingsLayoutProps) {
  const { userId, organizationId } = await requireOrganization();

  // Sidebar gating is permission-based; every page and action re-checks with
  // requirePermission, so this is presentation only.
  const permissions = Array.from(
    await getUserPermissionSet(userId, organizationId)
  );
  const t = await getTranslations("common");

  return (
    <SectionLayout
      title={t("settings")}
      nav={<SettingsSidebar permissions={permissions} />}
    >
      {children}
    </SectionLayout>
  );
}
