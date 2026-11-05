// src/app/super-admin/tenant/page.tsx
import { getTenantInfo } from "@/actions/super-admin/tenant-settings";
import { CreateTenantForm } from "@/components/super-admin/create-tenant-form";
import { TenantSettingsForm } from "@/components/super-admin/tenant-settings-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tenant Settings | Super Admin",
};

export default async function TenantSettingsPage() {
  const result = await getTenantInfo();

  // No tenant → show the creation form
  if (!result.success || !result.data) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-foreground text-2xl font-medium">
            Tenant Settings
          </h1>
          <p className="text-muted-foreground text-[0.9375rem]">
            Manage the basic information of your organization.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Tenant</CardTitle>
            <CardDescription>
              There is no tenant (organization) yet. Please create a tenant
              first. Once it is created, you can invite administrators.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateTenantForm />
          </CardContent>
        </Card>
      </div>
    );
  }

  const tenant = result.data;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-foreground text-2xl font-medium">
          Tenant Settings
        </h1>
        <p className="text-muted-foreground text-[0.9375rem]">
          Manage the basic information of your organization.
        </p>
      </div>

      {/* Basic information card */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription className="truncate">
            Tenant ID: <code className="font-mono text-xs">{tenant.id}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="bg-muted min-w-0 rounded-md p-4">
            <span className="text-muted-foreground text-xs tracking-wide uppercase">
              Total users
            </span>
            <p className="text-foreground truncate text-lg font-medium tabular-nums">
              {tenant.userCount.toLocaleString("en-US")} users
            </p>
          </div>
          <div className="bg-muted min-w-0 rounded-md p-4">
            <span className="text-muted-foreground text-xs tracking-wide uppercase">
              Total subscriptions
            </span>
            <p className="text-foreground truncate text-lg font-medium tabular-nums">
              {tenant.subscriptionCount.toLocaleString("en-US")} subscriptions
            </p>
          </div>
          <div className="bg-muted min-w-0 rounded-md p-4">
            <span className="text-muted-foreground text-xs tracking-wide uppercase">
              Created
            </span>
            <p className="text-foreground truncate text-lg font-medium tabular-nums">
              {new Date(tenant.createdAt).toLocaleDateString("en-US")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Edit form */}
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
    </div>
  );
}
