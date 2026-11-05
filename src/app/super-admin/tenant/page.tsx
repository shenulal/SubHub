// src/app/super-admin/tenant/page.tsx
import {
  getTenantInfo,
  listTenants,
  type TenantInfo,
} from "@/actions/super-admin/tenant-settings";
import { CreateTenantForm } from "@/components/super-admin/create-tenant-form";
import { TenantSettingsForm } from "@/components/super-admin/tenant-settings-form";
import { TenantStatusButton } from "@/components/super-admin/tenant-status-button";
import { TenantsTable } from "@/components/super-admin/tenants-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isSaas } from "@/lib/deployment/mode";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tenant Settings | Super Admin",
};

interface PageProps {
  searchParams: Promise<{ org?: string }>;
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-1">
      <h1 className="text-foreground text-2xl font-medium">{title}</h1>
      <p className="text-muted-foreground text-[0.9375rem]">{subtitle}</p>
    </div>
  );
}

function CreateTenantCard({ description }: { description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Tenant</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <CreateTenantForm />
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted min-w-0 rounded-md p-4">
      <span className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </span>
      <p className="text-foreground truncate text-lg font-medium tabular-nums">
        {value}
      </p>
    </div>
  );
}

function TenantDetail({ tenant, saas }: { tenant: TenantInfo; saas: boolean }) {
  const query = saas ? `?org=${tenant.id}` : "";
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <CardTitle className="flex min-w-0 items-center gap-2">
              <span className="truncate">{tenant.name}</span>
              {saas && (
                <Badge variant={tenant.deactivatedAt ? "error" : "success"}>
                  {tenant.deactivatedAt ? "Deactivated" : "Active"}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="truncate">
              Tenant ID: <code className="font-mono text-xs">{tenant.id}</code>
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/super-admin/admins${query}`}>Administrators</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/super-admin/extension-builds${query}`}>
                Extension builds
              </Link>
            </Button>
            {saas && (
              <TenantStatusButton
                tenantId={tenant.id}
                tenantName={tenant.name}
                deactivated={Boolean(tenant.deactivatedAt)}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="Total users"
            value={`${tenant.userCount.toLocaleString("en-US")} users`}
          />
          <Stat
            label="Total subscriptions"
            value={`${tenant.subscriptionCount.toLocaleString("en-US")} subscriptions`}
          />
          <Stat
            label="Created"
            value={new Date(tenant.createdAt).toLocaleDateString("en-US")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edit Information</CardTitle>
          <CardDescription>
            You can edit the company name, domain and logo URL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TenantSettingsForm tenant={tenant} />
        </CardContent>
      </Card>
    </>
  );
}

async function SaasTenantList() {
  const result = await listTenants();
  return (
    <div className="space-y-6">
      <Heading
        title="Tenants"
        subtitle="Every customer organisation on this platform. Open a tenant to edit it or manage its administrators."
      />
      <CreateTenantCard description="Creates an organisation with its default roles and master data. Invite its first administrator from Admin Management." />
      <Card>
        <CardHeader>
          <CardTitle>All tenants</CardTitle>
          <CardDescription>
            Deactivating a tenant keeps its data and blocks its members until it
            is reactivated.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <TenantsTable tenants={result.data ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}

export default async function TenantSettingsPage({ searchParams }: PageProps) {
  const { org } = await searchParams;
  const saas = isSaas();
  if (saas && !org) return <SaasTenantList />;

  const result = await getTenantInfo(org);
  if (!result.success || !result.data) {
    return (
      <div className="space-y-6">
        <Heading
          title="Tenant Settings"
          subtitle="Manage the basic information of your organization."
        />
        {saas ? (
          <Card>
            <CardContent className="text-muted-foreground py-16 text-center text-[0.9375rem]">
              {result.message ?? "Tenant information not found."}{" "}
              <Link
                href="/super-admin/tenant"
                className="text-primary hover:underline"
              >
                Back to tenants
              </Link>
            </CardContent>
          </Card>
        ) : (
          <CreateTenantCard description="First-run setup: this installation has no organisation yet. Create it here (or let the first user sign up), then invite its administrators. A single-tenant installation holds exactly one organisation." />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Heading
        title={saas ? "Tenant" : "Tenant Settings"}
        subtitle={
          saas
            ? "Edit this tenant's profile and lifecycle."
            : "The organisation of this single-tenant installation. Creating further organisations is disabled."
        }
      />
      {saas && (
        <Link
          href="/super-admin/tenant"
          className="text-primary text-[0.8125rem] hover:underline"
        >
          ← All tenants
        </Link>
      )}
      <TenantDetail tenant={result.data} saas={saas} />
    </div>
  );
}
