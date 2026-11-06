// src/app/super-admin/(console)/tenants/page.tsx
/** SaaS tenant directory. Single-tenant installations use Installation instead. */
import { listTenantDirectory } from "@/actions/super-admin/tenants";
import { PageHeading } from "@/components/super-admin/page-heading";
import { TenantDirectoryFilters } from "@/components/super-admin/tenants/tenant-directory-filters";
import { TenantDirectoryTable } from "@/components/super-admin/tenants/tenant-directory-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { isSaas } from "@/lib/deployment/mode";
import { getSystemSetting } from "@/lib/settings/service";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Tenants" };

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

const STATUS_VALUES = new Set(["all", "active", "suspended"]);

export default async function TenantsPage({ searchParams }: PageProps) {
  if (!isSaas()) redirect("/super-admin/installation");
  const { q, status } = await searchParams;
  const safeStatus = (status && STATUS_VALUES.has(status) ? status : "all") as
    | "all"
    | "active"
    | "suspended";
  const [result, timeZone, debounceMs] = await Promise.all([
    listTenantDirectory({ search: q?.slice(0, 100), status: safeStatus }),
    getSystemSetting("general.timezone"),
    getSystemSetting("discovery.searchDebounceMs"),
  ]);
  const rows = result.data ?? [];
  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Tenants"
        subtitle="Every customer organisation on this platform. Suspending keeps data and blocks members; deleting hides the tenant and retains its data."
        actions={
          <Button asChild>
            <Link href="/super-admin/tenants/new">
              <Plus />
              Create tenant
            </Link>
          </Button>
        }
      />
      <Card>
        <CardHeader className="pb-4">
          <TenantDirectoryFilters debounceMs={debounceMs} />
        </CardHeader>
        <CardContent className="px-0">
          {result.success ? (
            <TenantDirectoryTable
              rows={rows}
              timeZone={timeZone}
              filtered={Boolean(q) || safeStatus !== "all"}
            />
          ) : (
            <p className="tonal-error mx-5 rounded-md p-3 text-[0.875rem]">
              {result.error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
