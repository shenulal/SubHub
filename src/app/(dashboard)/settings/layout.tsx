// src/app/(dashboard)/settings/layout.tsx
import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import { Card } from "@/components/ui/card";
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
    <div className="space-y-5">
      <div className="space-y-0.5">
        <h2 className="text-foreground text-2xl leading-tight font-medium">
          {t("settings")}
        </h2>
      </div>

      {/* Sidebar and content area */}
      <div className="flex min-w-0 flex-col gap-6 xl:flex-row xl:items-start">
        {/* Left sidebar menu - Card */}
        <aside className="min-w-0 xl:sticky xl:top-20 xl:w-[260px] xl:shrink-0">
          <Card className="gap-0 p-2">
            <SettingsSidebar permissions={permissions} />
          </Card>
        </aside>

        {/* Right content area - Card */}
        <main className="min-w-0 flex-1">
          <Card className="min-w-0 gap-0 p-5 sm:p-6">{children}</Card>
        </main>
      </div>
    </div>
  );
}
