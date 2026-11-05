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
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const cards = [
    {
      title: "Total Users",
      value: stats.totalUsers.toLocaleString("en-US"),
      description: `Active: ${stats.activeUsers.toLocaleString("en-US")}`,
      icon: Users,
    },
    {
      title: "Active Subscriptions",
      value: `${stats.totalSubscriptions}`,
      description: "Current number of active subscriptions",
      icon: UserCheck,
    },
    {
      title: "Total Cost This Month",
      value: formatCurrency(stats.monthlyTotalCost, stats.currency),
      description: "Monthly-equivalent subscription cost",
      icon: DollarSign,
    },
    {
      title: "Latest Extension Build",
      value: stats.latestBuildVersion ? `v${stats.latestBuildVersion}` : "None",
      description: stats.latestBuildDate
        ? `Built: ${new Date(stats.latestBuildDate).toLocaleDateString("en-US")}`
        : "No build history",
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
