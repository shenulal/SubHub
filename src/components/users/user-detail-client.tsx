// src/components/users/user-detail-client.tsx
"use client";

import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatMoney } from "@/lib/fx/convert";
import type { UserDetail, UserSubscriptionSummary } from "@/types/user";
import type { UserRole, UserStatus } from "@prisma/client";
import { useCan, useGetIdentity, useShow } from "@refinedev/core";
import { format } from "date-fns";
import {
  ArrowLeft,
  CircleDot,
  Clock,
  CreditCard,
  Layers,
  LogOut,
  Mail,
  Shield,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";

import { TransferAdminDialog } from "@/components/team/transfer-admin-dialog";
import { OffboardUserDialog } from "./offboard-user-dialog";

interface UserDetailClientProps {
  id: string;
}

type TonalBadgeVariant = "secondary" | "success" | "info" | "primary" | "error";

const roleVariants: Record<UserRole, TonalBadgeVariant> = {
  SUPER_ADMIN: "primary",
  ADMIN: "primary",
  APPROVER: "info",
  MEMBER: "secondary",
  VIEWER: "secondary",
};

const statusVariants: Record<UserStatus, TonalBadgeVariant> = {
  ACTIVE: "success",
  INACTIVE: "secondary",
  TERMINATED: "error",
};

export function UserDetailClient({ id }: UserDetailClientProps) {
  const t = useTranslations();
  const router = useRouter();
  const [showOffboardDialog, setShowOffboardDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const {
    query: { data, isLoading },
  } = useShow<UserDetail>({
    resource: "users",
    id,
    queryOptions: { enabled: Boolean(id) },
  });
  const { data: canDelete } = useCan({
    resource: "users",
    action: "delete",
  });
  const { data: identity } = useGetIdentity<{
    id: string;
    role?: string | null;
  }>();

  const user = data?.data;

  const roleLabels: Record<UserRole, string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: t("users.role.admin"),
    APPROVER: t("users.role.approver"),
    MEMBER: t("users.role.member"),
    VIEWER: t("users.role.viewer"),
  };

  const statusLabels: Record<UserStatus, string> = {
    ACTIVE: t("users.status.active"),
    INACTIVE: t("users.status.inactive"),
    TERMINATED: t("users.status.terminated"),
  };

  if (isLoading) {
    return (
      <div className="text-muted-foreground text-sm">
        {t("users.detail.loading")}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">{t("users.detail.notFound")}</p>
        <Link href="/users">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("users.detail.backToList")}
          </Button>
        </Link>
      </div>
    );
  }

  const formattedLastLogin = user.lastLoginAt
    ? format(new Date(user.lastLoginAt), "yyyy-MM-dd")
    : "-";
  const formattedCreatedAt = user.createdAt
    ? format(new Date(user.createdAt), "yyyy-MM-dd")
    : "-";
  const subscriptionSummary = (
    user as unknown as { subscriptionSummary?: UserSubscriptionSummary }
  ).subscriptionSummary;

  const subscriptionsCtaHref = user.id
    ? `/subscriptions?owner=${user.id}`
    : "/subscriptions";

  const departmentDisplay = user.team?.name || user.department || "-";

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.name || user.email}
        description={t("users.detail.description", {
          department: departmentDisplay,
          count: user.assignedAppCount,
        })}
        showBack
        backHref="/users"
      >
        <div className="flex flex-wrap items-center gap-2">
          {canDelete?.can &&
            identity?.role === "ADMIN" &&
            user.role !== "ADMIN" &&
            identity.id !== user.id &&
            user.status === "ACTIVE" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTransferDialog(true)}
              >
                <ShieldAlert className="mr-1 h-4 w-4" />
                {t("users.transferAdmin.title")}
              </Button>
            )}
          {canDelete?.can && user.status !== "TERMINATED" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowOffboardDialog(true)}
            >
              <LogOut className="mr-1 h-4 w-4" />
              {t("users.offboard.title")}
            </Button>
          )}
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="flex min-w-0 items-center gap-3">
            <span className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-full text-base font-medium uppercase">
              {(user.name || user.email).charAt(0)}
            </span>
            <span className="truncate">{t("users.detail.accountInfo")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Account info grid */}
          <div className="grid gap-4 md:grid-cols-2">
            <InfoItem
              label={t("users.detail.email")}
              value={user.email}
              icon={<Mail className="h-4 w-4" />}
            />
            <InfoItem
              label={t("users.detail.department")}
              value={departmentDisplay}
              icon={<UserRound className="h-4 w-4" />}
            />
            <InfoItem
              label={t("users.detail.appAccessCount")}
              value={user.assignedAppCount.toString()}
              icon={<Shield className="h-4 w-4" />}
            />
            <InfoItem
              label={t("users.detail.lastLogin")}
              value={formattedLastLogin}
            />
            <InfoItem
              label={t("users.detail.createdAt")}
              value={formattedCreatedAt}
            />
          </div>

          <Separator />

          {/* Role & Status */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 rounded-md border p-3">
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs tracking-wide uppercase">
                <Shield className="h-3.5 w-3.5" />
                {t("users.detail.role")}
              </div>
              <div className="mt-1.5">
                <Badge variant={roleVariants[user.role]}>
                  {roleLabels[user.role]}
                </Badge>
              </div>
            </div>
            <div className="min-w-0 rounded-md border p-3">
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs tracking-wide uppercase">
                <CircleDot className="h-3.5 w-3.5" />
                {t("users.detail.status")}
              </div>
              <div className="mt-1.5">
                {user.status === "ACTIVE" ? (
                  <Badge variant="success">{statusLabels[user.status]}</Badge>
                ) : (
                  <Badge variant={statusVariants[user.status]}>
                    {statusLabels[user.status]}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Subscriptions */}
          <div className="space-y-3">
            <h4 className="text-[0.9375rem] font-medium">
              {t("users.detail.subscriptions")}
            </h4>
            {subscriptionSummary ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="bg-muted min-w-0 rounded-md p-3 text-center">
                  <Layers className="text-primary mx-auto h-4 w-4" />
                  <div className="mt-1 truncate text-2xl font-medium tabular-nums">
                    {subscriptionSummary.total}
                    <span className="text-sm font-normal">
                      {t("common.count")}
                    </span>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t("users.detail.totalSubscriptions")}
                  </div>
                </div>
                <div className="bg-muted min-w-0 rounded-md p-3 text-center">
                  <CreditCard className="text-info mx-auto h-4 w-4" />
                  <div
                    className="mt-1 truncate text-2xl font-medium tabular-nums"
                    title={formatMoney(
                      subscriptionSummary.monthlyAmount,
                      subscriptionSummary.currency
                    )}
                  >
                    {formatMoney(
                      subscriptionSummary.monthlyAmount,
                      subscriptionSummary.currency
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t("users.detail.monthlyCost")}
                  </div>
                </div>
                <div className="bg-muted min-w-0 rounded-md p-3 text-center">
                  <Clock
                    className={`mx-auto h-4 w-4 ${subscriptionSummary.renewingSoon > 0 ? "text-warning" : "text-muted-foreground"}`}
                  />
                  <div
                    className={`mt-1 truncate text-2xl font-medium tabular-nums ${subscriptionSummary.renewingSoon > 0 ? "text-warning" : ""}`}
                  >
                    {subscriptionSummary.renewingSoon}
                    <span className="text-sm font-normal">
                      {t("common.count")}
                    </span>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t("users.detail.renewingSoon")}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                {t("users.detail.noSubscriptions")}
              </p>
            )}
            <Link href={subscriptionsCtaHref}>
              <Button variant="outline" size="sm" className="w-full">
                {t("users.detail.viewSubscriptions")}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {user && (
        <>
          <OffboardUserDialog
            open={showOffboardDialog}
            onOpenChange={setShowOffboardDialog}
            user={user}
            onSuccess={() => {
              router.refresh();
              router.push("/users");
            }}
          />
          {identity && (
            <TransferAdminDialog
              open={showTransferDialog}
              onOpenChange={setShowTransferDialog}
              members={[
                {
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  role: user.role,
                  status: user.status,
                },
              ]}
              currentUserId={identity.id}
              onSuccess={() => router.refresh()}
            />
          )}
        </>
      )}
    </div>
  );
}

function InfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md border p-3">
      <div className="text-muted-foreground flex items-center gap-2 text-[0.8125rem]">
        {icon}
        {label}
      </div>
      <div className="mt-1 truncate font-medium" title={value}>
        {value}
      </div>
    </div>
  );
}
