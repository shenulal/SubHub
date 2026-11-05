"use client";

/**
 * Subscription detail: KPI strip, status/taxonomy chips, price-change banner
 * and the tabbed body (Overview / Documents / Activity / Cancellation).
 */
import { KpiCard, KpiCardsGrid } from "@/components/common/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { SubscriptionDetail as SubscriptionDetailType } from "@/types/subscription";
import type { AppCancellationOverride, CatalogItemDto } from "@/types/taxonomy";
import { Calendar, CircleDollarSign, RefreshCw, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { PriceChangeAlerts } from "./price-change-alerts";
import { SubscriptionActivity } from "./subscription-activity";
import { SubscriptionAttachments } from "./subscription-attachments";
import { SubscriptionComments } from "./subscription-comments";
import { SubscriptionDetailCancellation } from "./subscription-detail-cancellation";
import { SubscriptionDetailOverview } from "./subscription-detail-overview";
import {
  getBillingCycleLabels,
  getStatusLabels,
  statusToneClasses,
} from "./subscription-detail.constants";
import {
  formatCurrency,
  formatDate,
  getDaysUntilRenewal,
} from "./subscription-detail.utils";
import { SubscriptionStatusActions } from "./subscription-status-actions";

export interface DocumentPolicy {
  maxSizeMb: number;
  allowedMimeTypes: string[];
}

export interface SubscriptionDetailProps {
  subscription: SubscriptionDetailType;
  hideHeader?: boolean;
  documentPolicy?: DocumentPolicy;
  /** Days before the cancellation deadline during which the window is "open". */
  noticeWindowDays?: number;
  catalog?: CatalogItemDto | null;
  appOverride?: AppCancellationOverride | null;
}

const TABS = ["overview", "documents", "activity", "cancellation"] as const;
type Tab = (typeof TABS)[number];
const DEFAULT_NOTICE_WINDOW_DAYS = 7;
const LICENSE_WARN_PERCENT = 80;

const DEFAULT_DOCUMENT_POLICY: DocumentPolicy = {
  maxSizeMb: 15,
  allowedMimeTypes: ["application/pdf"],
};

export function SubscriptionDetail({
  subscription,
  hideHeader = false,
  documentPolicy = DEFAULT_DOCUMENT_POLICY,
  noticeWindowDays = DEFAULT_NOTICE_WINDOW_DAYS,
  catalog = null,
  appOverride = null,
}: SubscriptionDetailProps) {
  const t = useTranslations();
  const tl = useTranslations("lifecycle");
  const searchParams = useSearchParams();
  const requestedTab = searchParams?.get("tab");
  const [activityToken, setActivityToken] = useState(0);
  const initialTab: Tab = TABS.includes(requestedTab as Tab)
    ? (requestedTab as Tab)
    : "overview";

  const billingCycleLabels = getBillingCycleLabels(t);
  const statusLabels = getStatusLabels(t);
  const daysUntilRenewal = getDaysUntilRenewal(subscription.renewalDate);
  const licenseUsagePercent = subscription.totalLicenses
    ? ((subscription.usedLicenses ?? 0) / subscription.totalLicenses) * 100
    : 0;

  const bump = () => setActivityToken((n) => n + 1);

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-foreground text-2xl font-medium">
              {t("subscriptions.detail.title", {
                appName: subscription.appName,
              })}
            </h1>
            <p className="text-muted-foreground mt-1 text-[0.9375rem]">
              {t("subscriptions.detail.subtitle")}
            </p>
          </div>
          <SubscriptionStatusActions
            subscriptionId={subscription.id}
            appName={subscription.appName}
            status={subscription.status}
            onChanged={bump}
          />
        </div>
      )}

      {/* Status strip: status + taxonomy chips */}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            "h-6 px-2.5 text-[0.8125rem] font-medium",
            statusToneClasses[subscription.status]
          )}
        >
          {statusLabels[subscription.status]}
        </Badge>
        {subscription.isTrial && (
          <Badge variant="primary" className="h-6 px-2.5 text-[0.8125rem]">
            {subscription.trialEndsAt
              ? tl("badges.trialEnds", {
                  date: formatDate(subscription.trialEndsAt),
                })
              : tl("badges.trial")}
          </Badge>
        )}
        {subscription.isPersonal && (
          <Badge variant="secondary" className="h-6 px-2.5 text-[0.8125rem]">
            {tl("badges.personal")}
          </Badge>
        )}
        {subscription.status === "PAUSED" && subscription.pausedAt && (
          <span className="text-muted-foreground text-[0.8125rem] whitespace-nowrap">
            {tl("badges.pausedSince", {
              date: formatDate(subscription.pausedAt),
            })}
          </span>
        )}
        {subscription.status === "ARCHIVED" && subscription.archivedAt && (
          <span className="text-muted-foreground text-[0.8125rem] whitespace-nowrap">
            {tl("badges.archivedOn", {
              date: formatDate(subscription.archivedAt),
            })}
          </span>
        )}
        {subscription.category && (
          <Badge
            variant="outline"
            className="h-6 max-w-full px-2.5 text-[0.8125rem]"
            style={
              subscription.category.color
                ? { borderColor: subscription.category.color }
                : undefined
            }
          >
            {subscription.category.parentName
              ? `${subscription.category.parentName} / ${subscription.category.name}`
              : subscription.category.name}
          </Badge>
        )}
        {subscription.tags?.map((tag) => (
          <Badge
            key={tag.id}
            variant="secondary"
            className="h-6 max-w-[12rem] px-2.5 text-[0.8125rem] font-normal"
            title={tag.name}
          >
            {tag.name}
          </Badge>
        ))}
      </div>

      <PriceChangeAlerts subscriptionId={subscription.id} />

      <KpiCardsGrid columns={4}>
        <KpiCard
          title={t("subscriptions.detail.kpi.amount")}
          value={formatCurrency(subscription.amount, subscription.currency)}
          icon={CircleDollarSign}
          description={billingCycleLabels[subscription.billingCycle]}
        />
        <KpiCard
          title={t("subscriptions.detail.kpi.license")}
          value={
            subscription.totalLicenses
              ? `${subscription.usedLicenses ?? 0}/${subscription.totalLicenses}`
              : "-"
          }
          icon={Users}
          change={
            subscription.totalLicenses
              ? {
                  value: Math.round(licenseUsagePercent),
                  type:
                    licenseUsagePercent > LICENSE_WARN_PERCENT
                      ? "decrease"
                      : "neutral",
                }
              : undefined
          }
        />
        <KpiCard
          title={t("subscriptions.detail.kpi.renewalDate")}
          value={formatDate(subscription.renewalDate)}
          icon={Calendar}
          description={
            daysUntilRenewal !== null
              ? daysUntilRenewal > 0
                ? t("subscriptions.detail.period.daysLeft", {
                    days: daysUntilRenewal,
                  })
                : daysUntilRenewal === 0
                  ? t("subscriptions.detail.period.today")
                  : t("subscriptions.detail.period.daysPast", {
                      days: Math.abs(daysUntilRenewal),
                    })
              : undefined
          }
        />
        <KpiCard
          title={t("subscriptions.detail.kpi.autoRenewal")}
          value={
            subscription.autoRenewal
              ? t("subscriptions.detail.kpi.active")
              : t("subscriptions.detail.kpi.inactive")
          }
          icon={RefreshCw}
        />
      </KpiCardsGrid>

      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {tl(`tabs.${tab}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <SubscriptionDetailOverview
            subscription={subscription}
            noticeWindowDays={noticeWindowDays}
          />
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <SubscriptionAttachments
            subscriptionId={subscription.id}
            maxSizeMb={documentPolicy.maxSizeMb}
            allowedMimeTypes={documentPolicy.allowedMimeTypes}
          />
        </TabsContent>

        <TabsContent value="activity">
          <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_400px]">
            <SubscriptionActivity
              subscriptionId={subscription.id}
              refreshToken={activityToken}
            />
            <SubscriptionComments
              subscriptionId={subscription.id}
              onPosted={bump}
            />
          </div>
        </TabsContent>

        <TabsContent value="cancellation">
          <SubscriptionDetailCancellation
            subscriptionId={subscription.id}
            appId={subscription.appId}
            catalog={catalog}
            appOverride={
              appOverride ?? {
                cancellationUrl: subscription.app?.cancellationUrl ?? null,
                cancellationNotes: subscription.app?.cancellationNotes ?? null,
              }
            }
            noticePeriodDays={subscription.noticePeriodDays}
            cancellationUrl={subscription.cancellationUrl}
            cancellationNotes={subscription.cancellationNotes}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
