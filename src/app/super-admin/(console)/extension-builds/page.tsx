// src/app/super-admin/(console)/extension-builds/page.tsx
import { listExtensionBuilds } from "@/actions/super-admin/extension-builds";
import { ExtensionBuildsTable } from "@/components/super-admin/extension-builds-table";
import {
  SelectTenantCard,
  TenantScope,
} from "@/components/super-admin/tenant-scope";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isSaas } from "@/lib/deployment/mode";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Extension builds",
};

interface PageProps {
  searchParams: Promise<{ org?: string }>;
}

export default async function ExtensionBuildsPage({ searchParams }: PageProps) {
  const { org } = await searchParams;
  const needsTenant = isSaas() && !org;
  const result = needsTenant
    ? null
    : await listExtensionBuilds({ organizationId: org });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-foreground text-2xl font-medium">
          Extension Builds
        </h1>
        <p className="text-muted-foreground text-[0.9375rem]">
          Manage browser extension builds.
        </p>
      </div>

      <TenantScope selected={org} />

      {!result ? (
        <SelectTenantCard purpose="manage its browser extension builds" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Builds</CardTitle>
            <CardDescription>
              Create a new build or download an existing one.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {result.success && result.data ? (
              <ExtensionBuildsTable
                initialBuilds={result.data}
                organizationId={org}
              />
            ) : (
              <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
                {result.message ?? "Unable to load data."}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
