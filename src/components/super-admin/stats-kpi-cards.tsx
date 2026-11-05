// src/components/super-admin/stats-kpi-cards.tsx
import type { SuperAdminStats } from "@/actions/super-admin/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Box, DollarSign, UserCheck, Users } from "lucide-react";

interface StatsKpiCardsProps {
  stats: SuperAdminStats;
}

/** Materio card-statistics tile colours, in card order. */
const TONES = [
  "tonal-primary",
  "tonal-success",
  "tonal-warning",
  "tonal-info",
] as const;

export function StatsKpiCards({ stats }: StatsKpiCardsProps) {
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const cards = [
    {
      title: "총 사용자",
      value: stats.totalUsers.toLocaleString("ko-KR"),
      description: `활성: ${stats.activeUsers.toLocaleString("ko-KR")}명`,
      icon: Users,
    },
    {
      title: "활성 구독",
      value: `${stats.totalSubscriptions}개`,
      description: "현재 활성 구독 수",
      icon: UserCheck,
    },
    {
      title: "이번 달 총 비용",
      value: formatCurrency(stats.monthlyTotalCost, stats.currency),
      description: "월 환산 구독 비용",
      icon: DollarSign,
    },
    {
      title: "Extension 최신 빌드",
      value: stats.latestBuildVersion ? `v${stats.latestBuildVersion}` : "없음",
      description: stats.latestBuildDate
        ? `빌드일: ${new Date(stats.latestBuildDate).toLocaleDateString("ko-KR")}`
        : "빌드 기록 없음",
      icon: Box,
    },
  ];

  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, index) => (
        <Card key={card.title}>
          <CardContent className="flex min-w-0 flex-col gap-3">
            <div
              className={`flex size-10 items-center justify-center rounded-md ${TONES[index % TONES.length]}`}
            >
              <card.icon className="size-[22px]" />
            </div>
            <div className="min-w-0 space-y-1">
              <p
                className="text-muted-foreground truncate text-[0.8125rem]"
                title={card.title}
              >
                {card.title}
              </p>
              <div className="kpi-value text-foreground" title={card.value}>
                {card.value}
              </div>
              <p
                className="text-muted-foreground truncate text-[0.8125rem]"
                title={card.description}
              >
                {card.description}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
