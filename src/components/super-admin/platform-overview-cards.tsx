// src/components/super-admin/platform-overview-cards.tsx
/** SaaS console overview: platform-wide totals across every tenant. */
import type { PlatformOverview } from "@/actions/super-admin/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, CheckCircle2, Layers, Users } from "lucide-react";

export function PlatformOverviewCards({ data }: { data: PlatformOverview }) {
  const cards = [
    {
      title: "Tenants",
      value: data.tenantCount,
      hint: `${data.activeTenantCount.toLocaleString("en-US")} active`,
      icon: Building2,
      tone: "tonal-primary",
    },
    {
      title: "Active tenants",
      value: data.activeTenantCount,
      hint: `${(data.tenantCount - data.activeTenantCount).toLocaleString("en-US")} deactivated`,
      icon: CheckCircle2,
      tone: "tonal-success",
    },
    {
      title: "Tenant users",
      value: data.totalUsers,
      hint: "Members across all tenants",
      icon: Users,
      tone: "tonal-info",
    },
    {
      title: "Active subscriptions",
      value: data.activeSubscriptions,
      hint: "Across all tenants",
      icon: Layers,
      tone: "tonal-warning",
    },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.title}>
          <CardContent className="flex min-w-0 items-center gap-4">
            <div
              className={`${c.tone} flex size-10 shrink-0 items-center justify-center rounded-md`}
            >
              <c.icon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground truncate text-[0.8125rem]">
                {c.title}
              </p>
              <p className="text-foreground text-2xl font-medium tabular-nums">
                {c.value.toLocaleString("en-US")}
              </p>
              <p className="text-muted-foreground truncate text-xs">{c.hint}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
