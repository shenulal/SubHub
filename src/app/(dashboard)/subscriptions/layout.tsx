import { SectionLayout } from "@/components/layouts/section-layout";
import { SubscriptionsSidebar } from "@/components/subscriptions/subscriptions-sidebar";
import { getTranslations } from "next-intl/server";

interface SubscriptionsLayoutProps {
  children: React.ReactNode;
}

export default async function SubscriptionsLayout({
  children,
}: SubscriptionsLayoutProps) {
  const t = await getTranslations("sidebar.menu.subscriptions");

  // The subscriptions menu switches to a vertical list at 2xl.
  return (
    <SectionLayout
      title={t("root")}
      nav={<SubscriptionsSidebar />}
      breakpoint="2xl"
    >
      {children}
    </SectionLayout>
  );
}
