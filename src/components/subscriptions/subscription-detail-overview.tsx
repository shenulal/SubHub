"use client";

/**
 * Overview tab body: period, linked payments, additional info (left) and the
 * app / assignment / seat / notification cards (right). Extracted from the
 * original detail component so the tabbed layout stays under the size limit.
 */
import {
  type NotificationField,
  updateNotificationSettings,
} from "@/actions/notification-settings";
import { getLinkedPayments, type LinkedPayment } from "@/actions/subscriptions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCustomFieldValue } from "@/lib/services/taxonomy/custom-field-options";
import type { SubscriptionDetail as SubscriptionDetailType } from "@/types/subscription";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { NotificationSettings } from "./notification-settings";
import { SubscriptionContractCard } from "./subscription-contract-card";
import { SubscriptionDetailAppCard } from "./subscription-detail-app-card";
import { SubscriptionDetailPayments } from "./subscription-detail-payments";
import { SubscriptionDetailSeatCard } from "./subscription-detail-seat-card";
import { formatDate, getDaysUntilRenewal } from "./subscription-detail.utils";

interface SubscriptionDetailOverviewProps {
  subscription: SubscriptionDetailType;
  noticeWindowDays: number;
}

const RENEWAL_BADGE_DAYS = 30;
const RENEWAL_URGENT_DAYS = 7;

export function SubscriptionDetailOverview({
  subscription,
  noticeWindowDays,
}: SubscriptionDetailOverviewProps) {
  const t = useTranslations();
  const tl = useTranslations("lifecycle");
  const [isNotificationUpdating, setIsNotificationUpdating] = useState(false);
  const [alertSettings, setAlertSettings] = useState({
    renewalAlert30: subscription.renewalAlert30,
    renewalAlert60: subscription.renewalAlert60,
    renewalAlert90: subscription.renewalAlert90,
  });
  const [linkedPayments, setLinkedPayments] = useState<LinkedPayment[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);

  useEffect(() => {
    const loadPayments = async () => {
      setIsLoadingPayments(true);
      const result = await getLinkedPayments(subscription.id);
      if (result.success && result.data) setLinkedPayments(result.data);
      setIsLoadingPayments(false);
    };
    void loadPayments();
  }, [subscription.id]);

  const handleNotificationChange = async (
    field: NotificationField,
    value: boolean
  ) => {
    setIsNotificationUpdating(true);
    setAlertSettings((prev) => ({ ...prev, [field]: value }));
    const result = await updateNotificationSettings(
      subscription.id,
      field,
      value
    );
    if (!result.success) {
      setAlertSettings((prev) => ({ ...prev, [field]: !value }));
    }
    setIsNotificationUpdating(false);
  };

  const daysUntilRenewal = getDaysUntilRenewal(subscription.renewalDate);

  return (
    <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("subscriptions.detail.period.title")}</CardTitle>
            <CardDescription>
              {t("subscriptions.detail.period.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3">
              <div className="bg-muted/60 min-w-0 rounded-md p-4">
                <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {t("subscriptions.detail.period.startDate")}
                </dt>
                <dd className="text-foreground mt-1.5 truncate text-[0.9375rem] font-medium tabular-nums">
                  {formatDate(subscription.startDate)}
                </dd>
              </div>
              <div className="bg-muted/60 min-w-0 rounded-md p-4">
                <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {t("subscriptions.detail.period.endDate")}
                </dt>
                <dd className="text-foreground mt-1.5 truncate text-[0.9375rem] font-medium tabular-nums">
                  {formatDate(subscription.endDate)}
                </dd>
              </div>
              <div className="bg-muted/60 min-w-0 rounded-md p-4">
                <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {t("subscriptions.detail.period.renewalDate")}
                </dt>
                <dd className="text-foreground mt-1.5 flex flex-wrap items-center gap-2 text-[0.9375rem] font-medium tabular-nums">
                  {formatDate(subscription.renewalDate)}
                  {daysUntilRenewal !== null &&
                    daysUntilRenewal <= RENEWAL_BADGE_DAYS && (
                      <Badge
                        variant={
                          daysUntilRenewal <= RENEWAL_URGENT_DAYS
                            ? "outline"
                            : "warning"
                        }
                        className={
                          daysUntilRenewal <= RENEWAL_URGENT_DAYS
                            ? "bg-error/15 text-error border-transparent"
                            : undefined
                        }
                      >
                        {t("subscriptions.detail.period.daysLeft", {
                          days: daysUntilRenewal,
                        })}
                      </Badge>
                    )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <SubscriptionContractCard
          startDate={subscription.startDate}
          endDate={subscription.endDate}
          autoRenewal={subscription.autoRenewal}
          noticePeriodDays={subscription.noticePeriodDays}
          cancellationDeadline={subscription.cancellationDeadline}
          reminderLeadDays={subscription.reminderLeadDays ?? []}
          windowDays={noticeWindowDays}
        />

        <SubscriptionDetailPayments
          linkedPayments={linkedPayments}
          isLoading={isLoadingPayments}
        />

        <Card>
          <CardHeader>
            <CardTitle>{t("subscriptions.detail.additional.title")}</CardTitle>
            <CardDescription>
              {t("subscriptions.detail.additional.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex min-w-0 items-center justify-between gap-4 text-[0.9375rem]">
              <span className="text-muted-foreground">
                {t("subscriptions.detail.additional.contract")}
              </span>
              {subscription.contractUrl ? (
                <Button variant="link" asChild className="h-auto p-0">
                  <a
                    href={subscription.contractUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("subscriptions.detail.additional.viewContract")}
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </Button>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </div>
            {(subscription.customFieldValues ?? []).length > 0 && (
              <>
                <Separator />
                <dl className="grid gap-4 sm:grid-cols-2">
                  {subscription.customFieldValues.map((cfv) => (
                    <div key={cfv.fieldId} className="min-w-0">
                      <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                        {cfv.label}
                      </dt>
                      <dd className="text-foreground mt-1 text-[0.9375rem] font-medium break-words">
                        {cfv.fieldType
                          ? formatCustomFieldValue(cfv.fieldType, cfv.value)
                          : cfv.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
            {subscription.notes && (
              <>
                <Separator />
                <div>
                  <span className="text-muted-foreground text-xs tracking-wide uppercase">
                    {t("subscriptions.detail.additional.notes")}
                  </span>
                  <p className="text-foreground mt-1 text-[0.9375rem] break-words whitespace-pre-wrap">
                    {subscription.notes}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="text-muted-foreground text-[0.8125rem]">
          {t("subscriptions.detail.metadata.createdAt", {
            date: formatDate(subscription.createdAt),
          })}{" "}
          |{" "}
          {t("subscriptions.detail.metadata.updatedAt", {
            date: formatDate(subscription.updatedAt),
          })}
        </div>
      </div>

      <div className="min-w-0 space-y-6">
        <SubscriptionDetailAppCard
          appName={subscription.appName}
          appLogoUrl={subscription.appLogoUrl}
          status={subscription.status}
          billingCycle={subscription.billingCycle}
          amount={subscription.amount}
          currency={subscription.currency}
        />

        <Card>
          <CardHeader>
            <CardTitle>{t("subscriptions.detail.assignment.title")}</CardTitle>
            <CardDescription>
              {t("subscriptions.detail.assignment.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {subscription.owner && (
              <>
                <div className="flex min-w-0 items-center justify-between gap-4 text-[0.9375rem]">
                  <span className="text-muted-foreground shrink-0">
                    {tl("form.terms.owner")}
                  </span>
                  <span className="text-foreground min-w-0 truncate font-medium">
                    {subscription.owner.name ?? subscription.owner.email}
                  </span>
                </div>
                <Separator />
              </>
            )}
            <div className="flex min-w-0 items-center justify-between gap-4 text-[0.9375rem]">
              <span className="text-muted-foreground shrink-0">
                {t("subscriptions.detail.assignment.team")}
              </span>
              {subscription.teams && subscription.teams.length > 0 ? (
                <div className="flex min-w-0 flex-wrap justify-end gap-1">
                  {subscription.teams.map((team) => (
                    <Badge key={team.id} variant="secondary">
                      {team.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-foreground min-w-0 truncate font-medium">
                  {subscription.teamName ?? "-"}
                </span>
              )}
            </div>
            <Separator />
            <div>
              <span className="text-muted-foreground text-[0.9375rem]">
                {t("subscriptions.detail.assignment.assignedUsers")}
              </span>
              {subscription.assignedUsers &&
              subscription.assignedUsers.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {subscription.assignedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex min-w-0 items-center gap-3 text-[0.9375rem]"
                    >
                      <div className="tonal-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                        {(user.name ?? user.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 truncate">
                        <span className="text-foreground font-medium">
                          {user.name ?? user.email}
                        </span>
                        {user.name && (
                          <span className="text-muted-foreground ml-1 text-[0.8125rem]">
                            ({user.email})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground mt-1 text-[0.8125rem]">
                  {t("subscriptions.detail.assignment.noUsers")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <SubscriptionDetailSeatCard
          subscriptionId={subscription.id}
          totalLicenses={subscription.totalLicenses}
          usedLicenses={subscription.usedLicenses}
          billingType={subscription.billingType}
          perSeatPrice={subscription.perSeatPrice}
          currency={subscription.currency}
        />

        <NotificationSettings
          subscriptionId={subscription.id}
          renewalAlert30={alertSettings.renewalAlert30}
          renewalAlert60={alertSettings.renewalAlert60}
          renewalAlert90={alertSettings.renewalAlert90}
          onChange={handleNotificationChange}
          disabled={isNotificationUpdating}
        />
      </div>
    </div>
  );
}
