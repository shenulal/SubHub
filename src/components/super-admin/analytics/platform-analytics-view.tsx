// src/components/super-admin/analytics/platform-analytics-view.tsx
/** Analytics across every organisation (SaaS, "All organisations"). */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlatformAnalytics } from "@/types/platform-analytics";
import {
  Building2,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  LogIn,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { formatCount } from "../format";
import { money } from "./analytics-format";
import { StaleRatesNote } from "./analytics-panels";
import { MonthlyBarsChart } from "./monthly-bars-chart";
import { OrganizationComparisonTable } from "./organization-comparison-table";
import { SpendDonut } from "./spend-donut";
import { SpendTrendChart } from "./spend-trend-chart";
import { StatGrid, type StatTileProps } from "./stat-tile";
import { TopAppsCard } from "./top-apps-card";

function platformTiles(data: PlatformAnalytics): StatTileProps[] {
  const { kpis, currency, period } = data;
  return [
    {
      title: "Organisations",
      value: formatCount(kpis.organizations),
      caption: `${formatCount(kpis.activeOrganizations)} active · ${formatCount(kpis.suspendedOrganizations)} suspended`,
      icon: Building2,
      tone: "primary",
    },
    {
      title: "Users",
      value: formatCount(kpis.users),
      caption: `${formatCount(kpis.activeUsers)} active accounts`,
      icon: Users,
      tone: "info",
    },
    {
      title: "Signed in",
      value: formatCount(kpis.signedInUsers),
      caption: `Users signed in · ${period.label.toLowerCase()}`,
      icon: LogIn,
      tone: "success",
    },
    {
      title: "Active subscriptions",
      value: formatCount(kpis.activeSubscriptions),
      caption: "Across all organisations",
      icon: CreditCard,
      tone: "warning",
    },
    {
      title: "Monthly spend",
      value: money(kpis.monthlySpend, currency),
      caption: `Monthly equivalent in ${currency}`,
      icon: Wallet,
      tone: "primary",
    },
    {
      title: "Annual run-rate",
      value: money(kpis.annualRunRate, currency),
      caption: "Monthly spend × 12",
      icon: TrendingUp,
      tone: "success",
    },
    {
      title: "Renewals due",
      value: formatCount(kpis.renewalsDue),
      caption: `In the next ${data.renewalWindowDays} days`,
      icon: CalendarClock,
      tone: "info",
    },
    {
      title: "Pending approvals",
      value: formatCount(kpis.pendingApprovals),
      caption: "Awaiting a decision",
      icon: ClipboardCheck,
      tone: "warning",
    },
  ];
}

export function PlatformAnalyticsView({
  data,
  timeZone,
}: {
  data: PlatformAnalytics;
  timeZone: string;
}) {
  return (
    <div className="flex flex-col gap-6" data-testid="platform-analytics">
      {data.hasStaleRates && <StaleRatesNote />}
      <StatGrid tiles={platformTiles(data)} />
      <div className="grid min-w-0 gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <SpendTrendChart data={data.spendTrend} currency={data.currency} />
        </div>
        <SpendDonut
          title="Spend by category"
          caption={`Monthly, in ${data.currency}`}
          slices={data.spendByCategory}
          currency={data.currency}
        />
      </div>
      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <MonthlyBarsChart
          title="Growth"
          caption={`New records per month · ${data.period.label.toLowerCase()}`}
          data={data.growth}
          series={[
            { key: "organizations", label: "Organisations" },
            { key: "users", label: "Users" },
            { key: "subscriptions", label: "Subscriptions" },
          ]}
          emptyIcon="growth"
          emptyMessage="Nothing new in this period."
          testId="analytics-growth"
        />
        <TopAppsCard
          bySpend={data.topAppsBySpend}
          byAdoption={data.topAppsByAdoption}
          currency={data.currency}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Organisations</CardTitle>
          <p className="text-muted-foreground text-[0.8125rem]">
            Monthly spend in {data.currency}. Open an organisation for its own
            analytics.
          </p>
        </CardHeader>
        <CardContent className="px-0">
          <OrganizationComparisonTable
            rows={data.organizations}
            currency={data.currency}
            period={data.period.token}
            timeZone={timeZone}
          />
        </CardContent>
      </Card>
    </div>
  );
}
