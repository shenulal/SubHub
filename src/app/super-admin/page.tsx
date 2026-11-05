// src/app/super-admin/page.tsx
import {
  getResourceUsage,
  getSuperAdminStats,
} from "@/actions/super-admin/dashboard";
import { ResourceSummaryTable } from "@/components/super-admin/resource-summary-table";
import { StatsKpiCards } from "@/components/super-admin/stats-kpi-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Usage Overview | Super Admin",
};

export default async function SuperAdminHomePage() {
  const [statsResult, resourceResult] = await Promise.all([
    getSuperAdminStats(),
    getResourceUsage(),
  ]);

  // Guidance when there is no tenant
  const noTenant =
    !statsResult.success &&
    statsResult.message === "Tenant information not found.";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-foreground text-2xl font-medium">Usage Overview</h1>
        <p className="text-muted-foreground text-[0.9375rem]">
          View the overall status of the tenant.
        </p>
      </div>

      {noTenant ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <p className="text-muted-foreground text-[0.9375rem]">
              There is no tenant yet. Please create a tenant first.
            </p>
            <Button asChild>
              <Link href="/super-admin/tenant">Create tenant</Link>
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
