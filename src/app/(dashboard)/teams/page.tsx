import { Suspense } from "react";

import { PageHeader } from "@/components/common/page-header";
import { OrgLayout } from "@/components/org/org-layout";
import { TeamsPageClient } from "@/components/teams/teams-page-client";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("teams.page");
  return {
    title: `${t("title")}`,
    description: t("description"),
  };
}

function TeamsLoading() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-36 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[500px] rounded-lg" />
    </div>
  );
}

export default async function TeamsPage() {
  await requirePermissionOrRedirect("teams:read", "/dashboard");
  const t = await getTranslations("teams.page");
  return (
    <OrgLayout>
      <div className="flex min-w-0 flex-col gap-6">
        <PageHeader title={t("title")} description={t("description")} />

        <Suspense fallback={<TeamsLoading />}>
          <TeamsPageClient />
        </Suspense>
      </div>
    </OrgLayout>
  );
}
