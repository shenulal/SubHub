// src/app/(dashboard)/extensions/whitelist/page.tsx
import { WhitelistPageClient } from "@/components/extensions/whitelist-page-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";

export const metadata = {
  title: "Whitelist",
  description: "Manage allowed domains",
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

export default function WhitelistPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-foreground text-xl font-medium">Whitelist</h1>
      <Suspense fallback={<PageSkeleton />}>
        <WhitelistPageClient />
      </Suspense>
    </div>
  );
}
