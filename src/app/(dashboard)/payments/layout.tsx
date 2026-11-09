import { SectionLayout } from "@/components/layouts/section-layout";
import { PaymentsSidebar } from "@/components/payments/payments-sidebar";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import { getTranslations } from "next-intl/server";

interface PaymentsLayoutProps {
  children: React.ReactNode;
}

export default async function PaymentsLayout({
  children,
}: PaymentsLayoutProps) {
  await requirePermissionOrRedirect("payments:read", "/dashboard");
  const t = await getTranslations("sidebar.menu.payments");

  return (
    <SectionLayout title={t("root")} nav={<PaymentsSidebar />}>
      {children}
    </SectionLayout>
  );
}
