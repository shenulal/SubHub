// src/app/super-admin/(console)/page.tsx
/**
 * Control Panel → Analytics (read-only). SaaS: all organisations by default,
 * or one organisation via `?org=`. Single-tenant: the installation's
 * organisation. Period via `?period=` (tokens from Platform settings).
 */
import { NO_TENANT_MESSAGE } from "@/actions/super-admin/_tenant";
import {
  getOrganizationAnalytics,
  getPlatformAnalytics,
} from "@/actions/super-admin/analytics";
import { listTenants } from "@/actions/super-admin/tenant-settings";
import {
  AnalyticsToolbar,
  type ScopeOption,
} from "@/components/super-admin/analytics/analytics-toolbar";
import { OrganizationAnalyticsView } from "@/components/super-admin/analytics/organization-analytics-view";
import { PlatformAnalyticsView } from "@/components/super-admin/analytics/platform-analytics-view";
import { PageHeading } from "@/components/super-admin/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isSaas } from "@/lib/deployment/mode";
import { getSystemSetting } from "@/lib/settings/service";
import { BarChart3 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Analytics",
};

interface PageProps {
  searchParams: Promise<{ org?: string; period?: string }>;
}

async function scopeOptions(): Promise<ScopeOption[]> {
  const result = await listTenants();
  return (result.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    deactivated: Boolean(t.deactivatedAt),
  }));
}

function Unavailable({ message, saas }: { message: string; saas: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <span className="tonal-neutral flex size-12 items-center justify-center rounded-md">
          <BarChart3 className="size-6" aria-hidden />
        </span>
        <p className="text-muted-foreground text-[0.9375rem]">{message}</p>
        <Button asChild>
          <Link href={saas ? "/super-admin" : "/super-admin/installation"}>
            {saas ? "All organisations" : "Set up the installation"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

async function PlatformScope({ period }: { period?: string }) {
  const [result, organizations, timeZone] = await Promise.all([
    getPlatformAnalytics({ period }),
    scopeOptions(),
    getSystemSetting("general.timezone"),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Analytics"
        subtitle="Usage and spend across every organisation on the platform."
      />
      {result.success && result.data ? (
        <>
          <AnalyticsToolbar
            organizations={organizations}
            period={result.data.period.token}
            periodOptions={result.data.period.options}
          />
          <PlatformAnalyticsView data={result.data} timeZone={timeZone} />
        </>
      ) : (
        <Unavailable
          message={result.error ?? "Could not load analytics."}
          saas
        />
      )}
    </div>
  );
}

async function OrganizationScope({
  org,
  period,
  saas,
}: {
  org?: string;
  period?: string;
  saas: boolean;
}) {
  const [result, organizations] = await Promise.all([
    getOrganizationAnalytics({ organizationId: org, period }),
    saas ? scopeOptions() : Promise.resolve(undefined),
  ]);
  const data = result.success ? result.data : undefined;
  const details = data
    ? saas
      ? `/super-admin/tenants/${data.organization.id}`
      : "/super-admin/installation"
    : null;
  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Analytics"
        subtitle={
          data
            ? `${data.organization.name} · amounts in ${data.currency}, the organisation's base currency.`
            : "Analytics for one organisation."
        }
        eyebrow={
          data?.organization.status === "suspended" ? (
            <Badge variant="warning">Suspended</Badge>
          ) : undefined
        }
        actions={
          details ? (
            <Button asChild size="sm" variant="outline">
              <Link href={details}>
                {saas ? "Tenant details" : "Installation"}
              </Link>
            </Button>
          ) : undefined
        }
      />
      {data ? (
        <>
          <AnalyticsToolbar
            organizations={organizations}
            selectedOrganization={saas ? data.organization.id : undefined}
            period={data.period.token}
            periodOptions={data.period.options}
          />
          <OrganizationAnalyticsView data={data} />
        </>
      ) : (
        <Unavailable
          saas={saas}
          message={
            result.error !== NO_TENANT_MESSAGE
              ? (result.error ?? "Could not load analytics.")
              : saas
                ? "This organisation no longer exists."
                : "This installation has no organisation yet. Create it from Installation (first-run setup)."
          }
        />
      )}
    </div>
  );
}

export default async function SuperAdminAnalyticsPage({
  searchParams,
}: PageProps) {
  const { org, period } = await searchParams;
  const saas = isSaas();
  if (saas && !org) return <PlatformScope period={period} />;
  return <OrganizationScope org={org} period={period} saas={saas} />;
}
