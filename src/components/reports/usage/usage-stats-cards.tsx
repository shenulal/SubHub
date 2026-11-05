// src/components/reports/usage/usage-stats-cards.tsx
"use client";

import { AppWindow, Gauge, PackageX, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { ReportStatCard } from "../report-stat-card";

interface UsageStatsSummary {
  totalActiveUsers: number;
  totalApps: number;
  unusedAppsCount: number;
  averageUsageRate: number;
}

interface UsageStatsCardsProps {
  summary: UsageStatsSummary;
}

export function UsageStatsCards({ summary }: UsageStatsCardsProps) {
  const t = useTranslations();
  const stats = [
    {
      icon: Users,
      title: t("reports.usage.stats.activeUsers.title"),
      value: summary.totalActiveUsers.toLocaleString(),
    },
    {
      icon: AppWindow,
      title: t("reports.usage.stats.totalApps.title"),
      value: summary.totalApps.toLocaleString(),
    },
    {
      icon: PackageX,
      title: t("reports.usage.stats.unusedApps.title"),
      value: summary.unusedAppsCount.toLocaleString(),
    },
    {
      icon: Gauge,
      title: t("reports.usage.stats.averageUsageRate.title"),
      value: `${summary.averageUsageRate}%`,
    },
  ];

  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <ReportStatCard
          key={stat.title}
          icon={stat.icon}
          tone="primary"
          title={stat.title}
          value={stat.value}
          className="border-none"
        />
      ))}
    </div>
  );
}
