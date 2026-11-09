// src/components/super-admin/analytics/organization-analytics-view.tsx
/** Analytics for one organisation, in that organisation's base currency. */
import type {
  CountSlice,
  OrganizationAnalytics,
  SpendSlice,
} from "@/types/platform-analytics";
import {
  AppWindow,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  Landmark,
  Layers,
  LogIn,
  ShieldCheck,
  TrendingUp,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";

import { formatCount, ROLE_LABELS } from "../format";
import { money, SUBSCRIPTION_STATUS_LABELS } from "./analytics-format";
import {
  ApprovalsCard,
  BreakdownCard,
  StaleRatesNote,
} from "./analytics-panels";
import { MonthlyBarsChart } from "./monthly-bars-chart";
import type { RankedItem } from "./ranked-list";
import { SpendDonut } from "./spend-donut";
import { SpendTrendChart } from "./spend-trend-chart";
import { StatGrid, type StatTileProps } from "./stat-tile";
import { TopAppsCard } from "./top-apps-card";

/** Third card of a three-up row spans both columns on the two-column layout. */
const LAST_OF_THREE =
  "md:col-span-2 md:h-auto md:min-h-[220px] xl:col-span-1 xl:h-[380px]";

const plural = (n: number, word: string) =>
  `${formatCount(n)} ${word}${n === 1 ? "" : "s"}`;

function organizationTiles(data: OrganizationAnalytics): StatTileProps[] {
  const { kpis, currency, period } = data;
  return [
    {
      title: "Users",
      value: formatCount(kpis.users),
      caption: `${formatCount(kpis.activeUsers)} active accounts`,
      icon: Users,
      tone: "primary",
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
      caption: "Currently active",
      icon: CreditCard,
      tone: "warning",
    },
    {
      title: "Apps",
      value: formatCount(kpis.apps),
      caption: `${plural(kpis.teams, "team")} in this organisation`,
      icon: AppWindow,
      tone: "info",
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

const spendItems = (slices: SpendSlice[], currency: string): RankedItem[] =>
  slices.map((s) => ({
    key: s.key,
    label: s.label,
    value: s.monthly,
    display: money(s.monthly, currency),
    hint: plural(s.count, "sub"),
  }));

const countItems = (
  slices: CountSlice[],
  labels: Record<string, string>
): RankedItem[] =>
  slices.map((s) => ({
    key: s.key,
    label: labels[s.key] ?? s.label,
    value: s.count,
    display: formatCount(s.count),
  }));

function SpendRows({ data }: { data: OrganizationAnalytics }) {
  const { currency } = data;
  return (
    <>
      <div className="grid min-w-0 gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <SpendTrendChart data={data.spendTrend} currency={currency} />
        </div>
        <SpendDonut
          title="Spend by category"
          caption={`Monthly, in ${currency}`}
          slices={data.spendByCategory}
          currency={currency}
        />
      </div>
      <div className="grid min-w-0 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <TopAppsCard
          bySpend={data.topApps}
          currency={currency}
          singleOrganization
        />
        <BreakdownCard
          title="Spend by team"
          caption={`Monthly, in ${currency}`}
          items={spendItems(data.spendByTeam, currency)}
          emptyIcon={UsersRound}
          emptyMessage="No active subscription spend."
          barClassName="bg-info"
          testId="analytics-spend-team"
        />
        <BreakdownCard
          title="Spend by cost centre"
          caption={`Monthly, in ${currency}`}
          items={spendItems(data.spendByCostCentre, currency)}
          emptyIcon={Landmark}
          emptyMessage="No active subscription spend."
          barClassName="bg-success"
          testId="analytics-spend-cost-centre"
          className={LAST_OF_THREE}
        />
      </div>
    </>
  );
}

function ActivityRows({ data }: { data: OrganizationAnalytics }) {
  const { kpis, period } = data;
  return (
    <>
      <div className="grid min-w-0 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <BreakdownCard
          title="Subscriptions by status"
          caption="All subscriptions"
          items={countItems(
            data.subscriptionsByStatus,
            SUBSCRIPTION_STATUS_LABELS
          )}
          emptyIcon={Layers}
          emptyMessage="No subscriptions yet."
          barClassName="bg-warning"
          testId="analytics-subscription-status"
        />
        <BreakdownCard
          title="Users by role"
          caption={plural(kpis.users, "user")}
          items={countItems(data.usersByRole, ROLE_LABELS)}
          emptyIcon={ShieldCheck}
          emptyMessage="No users yet."
          testId="analytics-users-role"
        />
        <ApprovalsCard
          approvals={data.approvals}
          periodLabel={period.label}
          className={LAST_OF_THREE}
        />
      </div>
      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <MonthlyBarsChart
          title="Sign-in activity"
          caption={`${formatCount(kpis.signedInUsers)} of ${formatCount(kpis.users)} users signed in · ${period.label.toLowerCase()}`}
          data={data.signIns}
          series={[
            { key: "signIns", label: "Sign-ins" },
            { key: "users", label: "Users signing in" },
          ]}
          emptyIcon="signIns"
          emptyMessage="No sign-ins in this period."
          testId="analytics-sign-ins"
        />
        <MonthlyBarsChart
          title="Growth"
          caption={`New records per month · ${period.label.toLowerCase()}`}
          data={data.growth}
          series={[
            { key: "users", label: "Users" },
            { key: "subscriptions", label: "Subscriptions" },
          ]}
          emptyIcon="growth"
          emptyMessage="Nothing new in this period."
          testId="analytics-growth"
        />
      </div>
    </>
  );
}

export function OrganizationAnalyticsView({
  data,
}: {
  data: OrganizationAnalytics;
}) {
  return (
    <div className="flex flex-col gap-6" data-testid="organization-analytics">
      {data.hasStaleRates && <StaleRatesNote />}
      <StatGrid tiles={organizationTiles(data)} />
      <SpendRows data={data} />
      <ActivityRows data={data} />
    </div>
  );
}
