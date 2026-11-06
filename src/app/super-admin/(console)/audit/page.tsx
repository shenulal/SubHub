// src/app/super-admin/(console)/audit/page.tsx
/** Platform audit log — every Control Panel action, filterable. */
import {
  getPlatformAuditFacets,
  listPlatformAudit,
} from "@/actions/super-admin/audit";
import { AuditFilters } from "@/components/super-admin/audit/audit-filters";
import { AuditTable } from "@/components/super-admin/audit/audit-table";
import { formatCount } from "@/components/super-admin/format";
import { PageHeading } from "@/components/super-admin/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getSystemSetting } from "@/lib/settings/service";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Audit log" };

type Search = Record<string, string | undefined>;

interface PageProps {
  searchParams: Promise<Search>;
}

const FILTER_KEYS = [
  "action",
  "entityType",
  "actorId",
  "organizationId",
  "from",
  "to",
] as const;

function pageHref(search: Search, page: number): string {
  const next = new URLSearchParams();
  for (const k of FILTER_KEYS) if (search[k]) next.set(k, search[k]!);
  if (page > 1) next.set("page", String(page));
  return next.size ? `/super-admin/audit?${next}` : "/super-admin/audit";
}

export default async function PlatformAuditPage({ searchParams }: PageProps) {
  const search = await searchParams;
  const query = Object.fromEntries(
    FILTER_KEYS.map((k) => [k, search[k] ?? ""])
  );
  const [result, facets, timeZone] = await Promise.all([
    listPlatformAudit({ ...query, page: search.page ?? "1" }),
    getPlatformAuditFacets(),
    getSystemSetting("general.timezone"),
  ]);
  const data = result.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Audit log"
        subtitle="Platform-level changes: tenants, tenant admins, platform admins, masters and platform settings. Tenant activity stays in each tenant's own audit log."
      />
      <Card>
        <CardHeader className="pb-4">
          {facets.data && <AuditFilters facets={facets.data} />}
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-0">
          {data ? (
            <AuditTable
              rows={data.rows}
              timeZone={timeZone}
              emptyText="No entries match the filters."
            />
          ) : (
            <p className="tonal-error mx-5 rounded-md p-3 text-[0.875rem]">
              {result.error}
            </p>
          )}
          {data && data.total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-5">
              <p className="text-muted-foreground text-[0.875rem]">
                {formatCount(data.total)} entries · page {data.page} of {pages}
              </p>
              <div className="flex gap-2">
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  aria-disabled={data.page <= 1}
                  className={
                    data.page <= 1 ? "pointer-events-none opacity-45" : ""
                  }
                >
                  <Link href={pageHref(search, data.page - 1)}>Previous</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  aria-disabled={data.page >= pages}
                  className={
                    data.page >= pages ? "pointer-events-none opacity-45" : ""
                  }
                >
                  <Link href={pageHref(search, data.page + 1)}>Next</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
