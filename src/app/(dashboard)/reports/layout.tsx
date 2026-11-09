import { SectionLayout } from "@/components/layouts/section-layout";
import { ReportsSidebar } from "@/components/reports/reports-sidebar";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import { getTranslations } from "next-intl/server";

interface ReportsLayoutProps {
  children: React.ReactNode;
}

export default async function ReportsLayout({ children }: ReportsLayoutProps) {
  await requirePermissionOrRedirect("reports:read", "/dashboard");
  const t = await getTranslations("sidebar.menu.reports");

  return (
    <SectionLayout title={t("root")} nav={<ReportsSidebar />}>
      {children}
    </SectionLayout>
  );
}
