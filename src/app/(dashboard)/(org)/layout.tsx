// src/app/(dashboard)/(org)/layout.tsx
// Shared frame for /teams, /users, /users/offboarded and /org/sync. Being a
// layout (not a wrapper inside each page) keeps the Org menu mounted across
// these pages, so it no longer reloads, flickers or loses its scroll position.
// Each page still runs its own permission check.
import { SectionLayout } from "@/components/layouts/section-layout";
import { OrgSidebar } from "@/components/org/org-sidebar";
import { getTranslations } from "next-intl/server";

export default async function OrgSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("sidebar.menu.org");
  return (
    <SectionLayout title={t("root")} nav={<OrgSidebar />}>
      {children}
    </SectionLayout>
  );
}
