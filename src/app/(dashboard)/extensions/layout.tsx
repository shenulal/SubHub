import { ExtensionsSidebar } from "@/components/extensions/extensions-sidebar";
import { SectionLayout } from "@/components/layouts/section-layout";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import { getTranslations } from "next-intl/server";

interface ExtensionsLayoutProps {
  children: React.ReactNode;
}

export default async function ExtensionsLayout({
  children,
}: ExtensionsLayoutProps) {
  await requirePermissionOrRedirect("extensions:read", "/dashboard");
  const t = await getTranslations("sidebar.menu.extensions");

  return (
    <SectionLayout title={t("root")} nav={<ExtensionsSidebar />}>
      {children}
    </SectionLayout>
  );
}
