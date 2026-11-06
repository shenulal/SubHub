// src/app/(dashboard)/extensions/blacklist/page.tsx
import { BlacklistPageClient } from "@/components/extensions/blacklist-page-client";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import { Suspense } from "react";

export const metadata = {
  title: "Blacklist",
  description: "Manage blocked domains",
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

export default async function BlacklistPage() {
  await requirePermissionOrRedirect("extensions:read", "/dashboard");
  return (
    <div className="space-y-6">
      <h1 className="text-foreground text-xl font-medium">Blacklist</h1>
      <Suspense fallback={<PageSkeleton />}>
        <BlacklistPageClient />
      </Suspense>
    </div>
  );
}
