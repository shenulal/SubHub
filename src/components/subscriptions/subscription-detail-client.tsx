"use client";

import { PageHeader } from "@/components/common/page-header";
import {
  SubscriptionDetail,
  type DocumentPolicy,
} from "@/components/subscriptions/subscription-detail";
import { SubscriptionStatusActions } from "@/components/subscriptions/subscription-status-actions";
import { Button } from "@/components/ui/button";
import type { SubscriptionDetail as SubscriptionDetailType } from "@/types/subscription";
import type { AppCancellationOverride, CatalogItemDto } from "@/types/taxonomy";
import { useShow } from "@refinedev/core";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface SubscriptionDetailClientProps {
  id: string;
  /** @deprecated permission gating now uses `<Can>`; kept for compatibility. */
  role?: "ADMIN" | "APPROVER" | "MEMBER" | "VIEWER" | null;
  documentPolicy?: DocumentPolicy;
  noticeWindowDays?: number;
  catalog?: CatalogItemDto | null;
  appOverride?: AppCancellationOverride | null;
}

export function SubscriptionDetailClient({
  id,
  documentPolicy,
  noticeWindowDays,
  catalog,
  appOverride,
}: SubscriptionDetailClientProps) {
  const {
    query: { data, isLoading, refetch },
  } = useShow<SubscriptionDetailType>({
    resource: "subscriptions",
    id,
    queryOptions: { enabled: Boolean(id) },
  });

  if (isLoading) {
    return (
      <div className="text-muted-foreground text-sm">
        구독 정보를 불러오는 중...
      </div>
    );
  }

  if (!data?.data) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">구독을 찾을 수 없습니다.</p>
        <Link href="/subscriptions">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록으로
          </Button>
        </Link>
      </div>
    );
  }

  const subscription = data.data;
  const appName = subscription.appName || "알 수 없음";

  return (
    <div className="space-y-6">
      <PageHeader title={`${appName} 구독`} showBack backHref="/subscriptions">
        <SubscriptionStatusActions
          subscriptionId={id}
          appName={appName}
          status={subscription.status}
          onChanged={() => void refetch?.()}
        />
      </PageHeader>
      <SubscriptionDetail
        subscription={subscription}
        hideHeader
        documentPolicy={documentPolicy}
        noticeWindowDays={noticeWindowDays}
        catalog={catalog}
        appOverride={appOverride}
      />
    </div>
  );
}
