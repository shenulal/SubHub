// src/app/(dashboard)/extensions/recommended-apps/page.tsx
import { RecommendedAppsPageClient } from "@/components/extensions/recommended-apps-page-client";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import { Suspense } from "react";

export const metadata = {
  title: "Recommended Apps",
  description:
    "Unregistered apps discovered through AI-based SaaS identification",
};

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

export default async function RecommendedAppsPage() {
  await requirePermissionOrRedirect("extensions:read", "/dashboard");
  return (
    <div className="space-y-6">
      <h1 className="text-foreground text-xl font-medium">Recommended Apps</h1>
      <Suspense fallback={<PageSkeleton />}>
        <RecommendedAppsPageClient />
      </Suspense>
    </div>
  );
}
