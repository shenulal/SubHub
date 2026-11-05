// src/app/super-admin/page.tsx
import {
  getPlatformOverview,
  getResourceUsage,
  getSuperAdminStats,
} from "@/actions/super-admin/dashboard";
import { listTenants } from "@/actions/super-admin/tenant-settings";
import { PlatformOverviewCards } from "@/components/super-admin/platform-overview-cards";
import { ResourceSummaryTable } from "@/components/super-admin/resource-summary-table";
import { StatsKpiCards } from "@/components/super-admin/stats-kpi-cards";
import { TenantScope } from "@/components/super-admin/tenant-scope";
import { TenantsTable } from "@/components/super-admin/tenants-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isSaas } from "@/lib/deployment/mode";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Usage Overview | Super Admin",
};

interface PageProps {
  searchParams: Promise<{ org?: string }>;
}

function Heading({ subtitle }: { subtitle: string }) {
  return (
    <div className="space-y-1">
      <h1 className="text-foreground text-2xl font-medium">Usage Overview</h1>
      <p className="text-muted-foreground text-[0.9375rem]">{subtitle}</p>
    </div>
  );
}

/** SaaS without a selected tenant: platform totals and the tenant list. */
async function PlatformOverviewView() {
  const [overview, tenants] = await Promise.all([
    getPlatformOverview(),
    listTenants(),
  ]);
  return (
    <div className="space-y-6">
      <Heading subtitle="Platform-wide usage across every tenant. Pick a tenant for its details." />
      <TenantScope />
      {overview.success && overview.data ? (
        <PlatformOverviewCards data={overview.data} />
      ) : (
        <div className="tonal-error rounded-md p-4 text-[0.9375rem]">
          {overview.message ?? "Failed to load statistics."}
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Tenants</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <TenantsTable tenants={tenants.data ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}

export default async function SuperAdminHomePage({ searchParams }: PageProps) {
  const { org } = await searchParams;
  const saas = isSaas();
  if (saas && !org) return <PlatformOverviewView />;

  const [statsResult, resourceResult] = await Promise.all([
    getSuperAdminStats(org),
    getResourceUsage(org),
  ]);

  // Guidance when there is no tenant
  const noTenant =
    !statsResult.success &&
    statsResult.message === "Tenant information not found.";

  return (
    <div className="space-y-6">
      <Heading
        subtitle={
          saas
            ? "Usage of the selected tenant."
            : "View the overall status of the tenant."
        }
      />
      <TenantScope selected={org} />

      {noTenant ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <p className="text-muted-foreground text-[0.9375rem]">
              {saas
                ? "This tenant no longer exists."
                : "There is no tenant yet. Please create a tenant first."}
            </p>
            <Button asChild>
              <Link href="/super-admin/tenant">
                {saas ? "All tenants" : "Create tenant"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {statsResult.success && statsResult.data ? (
            <StatsKpiCards stats={statsResult.data} />
          ) : (
            <div className="tonal-error rounded-md p-4 text-[0.9375rem]">
              {statsResult.message ?? "Failed to load statistics."}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Subscriptions by App</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {resourceResult.success && resourceResult.data ? (
                <ResourceSummaryTable data={resourceResult.data} />
              ) : (
                <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
                  Unable to load data.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
