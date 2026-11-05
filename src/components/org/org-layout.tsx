"use client";

import { OrgSidebar } from "@/components/org/org-sidebar";
import { Card } from "@/components/ui/card";
import { useTranslations } from "next-intl";

interface OrgLayoutProps {
  children: React.ReactNode;
}

export function OrgLayout({ children }: OrgLayoutProps) {
  const t = useTranslations("sidebar.menu.org");

  return (
    <div className="space-y-5">
      <div className="space-y-0.5">
        <h2 className="text-foreground text-2xl leading-tight font-medium">
          {t("root")}
        </h2>
      </div>
      <div className="flex min-w-0 flex-col gap-6 xl:flex-row xl:items-start">
        <aside className="min-w-0 xl:sticky xl:top-20 xl:w-[260px] xl:shrink-0">
          <Card className="gap-0 p-2">
            <OrgSidebar />
          </Card>
        </aside>
        <main className="min-w-0 flex-1">
          <Card className="min-w-0 gap-0 p-5 sm:p-6">{children}</Card>
        </main>
      </div>
    </div>
  );
}
