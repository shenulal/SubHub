// src/components/users/terminated-users-page-client.tsx
"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TerminatedUsersList } from "@/components/users/terminated-users-list";
import type { TerminatedUserWithAccess } from "@/types/user";
import { useList } from "@refinedev/core";
import { useTranslations } from "next-intl";

export function TerminatedUsersPageClient() {
  const t = useTranslations();
  const {
    query: { data, isLoading },
  } = useList<TerminatedUserWithAccess>({
    resource: "terminated-users",
    pagination: { pageSize: 20 },
  });

  const users = data?.data ?? [];

  // 로딩 상태 - Skeleton UI
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Terminated User Cards Skeleton */}
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                    <Skeleton className="mt-1 h-4 w-48" />
                    <Skeleton className="mt-1 h-3 w-64" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[1, 2].map((j) => (
                  <div
                    key={j}
                    className="bg-muted flex items-center justify-between rounded-md p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded" />
                      <div>
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="mt-1 h-3 w-32" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return <TerminatedUsersList users={users} />;
}
