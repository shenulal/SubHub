// src/components/apps/app-detail.tsx
import { KpiCard, KpiCardsGrid } from "@/components/common/kpi-card";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getAppStatusMeta } from "@/lib/app-status";
import { formatKoreanDate } from "@/lib/date";
import type { AppDetail as AppDetailType } from "@/types/app";
import {
  Calendar,
  CreditCard,
  ExternalLink,
  Globe,
  Tag,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { APP_STATUS_TONE } from "./app-status-tone";

interface AppDetailProps {
  app: AppDetailType;
  canEdit?: boolean;
}

export function AppDetail({ app, canEdit = true }: AppDetailProps) {
  const t = useTranslations();
  const logoUrl = app.customLogoUrl || app.catalogLogoUrl || null;
  const statusMeta = getAppStatusMeta(app.status, t);

  return (
    <div className="space-y-6">
      {/* 상단 KPI 카드 */}
      <KpiCardsGrid columns={4}>
        <KpiCard
          title={t("apps.detail.kpi.subscriptionCount")}
          value={app.subscriptionCount}
          icon={CreditCard}
        />
        <KpiCard
          title={t("apps.detail.kpi.userAccessCount")}
          value={app.userAccessCount}
          icon={Users}
        />
        <KpiCard
          title={t("apps.detail.kpi.status")}
          value={statusMeta.label}
          icon={Tag}
        />
        <KpiCard
          title={t("apps.detail.kpi.createdAt")}
          value={formatKoreanDate(app.createdAt)}
          icon={Calendar}
        />
      </KpiCardsGrid>

      {/* 2컬럼 레이아웃 - 레퍼런스: pages-products-1.png */}
      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        {/* 좌측 (span-2): 메인 콘텐츠 */}
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* 앱 로고 및 기본 정보 카드 */}
          <Card>
            <CardContent>
              <div className="flex min-w-0 flex-col gap-6 sm:flex-row">
                {/* 로고 */}
                <div className="shrink-0">
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt={app.name}
                      width={120}
                      height={120}
                      className="size-[120px] rounded-lg border object-contain p-2"
                    />
                  ) : (
                    <div className="tonal-primary flex size-[120px] items-center justify-center rounded-lg text-4xl font-medium">
                      {app.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                {/* 정보 */}
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={APP_STATUS_TONE[app.status]}
                    >
                      {statusMeta.label}
                    </Badge>
                    {app.category && (
                      <Badge variant="secondary">{app.category}</Badge>
                    )}
                  </div>
                  {app.customWebsite && (
                    <a
                      href={app.customWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary inline-flex max-w-full min-w-0 items-center gap-1 text-[0.9375rem] hover:underline"
                      title={app.customWebsite}
                    >
                      <Globe className="size-4 shrink-0" />
                      <span className="truncate">
                        {app.customWebsite.replace(/^https?:\/\//, "")}
                      </span>
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                  )}
                  <div className="grid gap-4 pt-2 sm:grid-cols-2">
                    <div className="bg-muted/60 min-w-0 rounded-md p-4">
                      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        {t("apps.detail.info.registrationMethod")}
                      </dt>
                      <dd className="text-foreground mt-1 truncate text-[0.9375rem] font-medium">
                        {app.source === "MANUAL"
                          ? t("apps.detail.info.manual")
                          : t("apps.detail.info.discovered")}
                      </dd>
                    </div>
                    <div className="bg-muted/60 min-w-0 rounded-md p-4">
                      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        {t("apps.detail.info.lastModified")}
                      </dt>
                      <dd className="text-foreground mt-1 truncate text-[0.9375rem] font-medium">
                        {formatKoreanDate(app.updatedAt)}
                      </dd>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 메모 카드 */}
          <Card>
            <CardHeader>
              <CardTitle>{t("apps.detail.notes.title")}</CardTitle>
              <CardDescription>
                {t("apps.detail.notes.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {app.notes ? (
                <p className="whitespace-pre-wrap">{app.notes}</p>
              ) : (
                <p className="text-muted-foreground">
                  {t("apps.detail.notes.empty")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* 리스크 정보 카드 (있을 경우) */}
          {app.riskScore !== null && (
            <Card>
              <CardHeader>
                <CardTitle>{t("apps.detail.risk.title")}</CardTitle>
                <CardDescription>
                  {t("apps.detail.risk.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div
                    className={`flex size-16 shrink-0 items-center justify-center rounded-full text-2xl font-medium ${
                      app.riskScore <= 3
                        ? "tonal-success"
                        : app.riskScore <= 6
                          ? "tonal-warning"
                          : "tonal-error"
                    }`}
                  >
                    {app.riskScore}
                  </div>
                  <div>
                    <p className="font-medium">
                      {app.riskScore <= 3
                        ? t("apps.detail.risk.low")
                        : app.riskScore <= 6
                          ? t("apps.detail.risk.medium")
                          : t("apps.detail.risk.high")}
                    </p>
                    <p className="text-muted-foreground text-[0.8125rem]">
                      {t("apps.detail.risk.scoreRange")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 우측 (span-1): 메타데이터 카드 */}
        <div className="min-w-0 space-y-6">
          {/* 담당자 카드 */}
          <Card>
            <CardHeader>
              <CardTitle>{t("apps.detail.owner.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              {app.ownerName ? (
                <div className="flex min-w-0 items-center gap-3">
                  <div className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-medium">
                    {app.ownerName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-foreground truncate font-medium">
                      {app.ownerName}
                    </div>
                    {app.ownerEmail && (
                      <div className="text-muted-foreground truncate text-[0.8125rem]">
                        {app.ownerEmail}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-[0.8125rem]">
                  {t("apps.detail.owner.empty")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* 배정 팀 카드 */}
          <Card>
            <CardHeader>
              <CardTitle>{t("apps.detail.assignedTeam.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              {app.teams && app.teams.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {app.teams.map((team) => (
                    <Badge key={team.id} variant="secondary">
                      {team.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-[0.8125rem]">
                  {t("apps.detail.assignedTeam.empty")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* 카테고리 카드 */}
          <Card>
            <CardHeader>
              <CardTitle>{t("apps.detail.category.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex min-w-0 items-center gap-2 text-[0.9375rem]">
                <Tag className="text-muted-foreground size-4 shrink-0" />
                <span className="truncate">
                  {app.category || t("apps.detail.category.uncategorized")}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 날짜 정보 카드 */}
          <Card>
            <CardHeader>
              <CardTitle>{t("apps.detail.dates.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-4 text-[0.9375rem]">
                <span className="text-muted-foreground">
                  {t("apps.detail.dates.createdAt")}
                </span>
                <span className="whitespace-nowrap tabular-nums">
                  {formatKoreanDate(app.createdAt)}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4 text-[0.9375rem]">
                <span className="text-muted-foreground">
                  {t("apps.detail.dates.updatedAt")}
                </span>
                <span className="whitespace-nowrap tabular-nums">
                  {formatKoreanDate(app.updatedAt)}
                </span>
              </div>
              {app.discoveredAt && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between gap-4 text-[0.9375rem]">
                    <span className="text-muted-foreground">
                      {t("apps.detail.dates.discoveredAt")}
                    </span>
                    <span className="whitespace-nowrap tabular-nums">
                      {formatKoreanDate(app.discoveredAt)}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 태그 카드 */}
          {app.tags && app.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("apps.detail.tags.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {app.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
