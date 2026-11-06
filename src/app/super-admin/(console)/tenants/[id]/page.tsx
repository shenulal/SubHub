// src/app/super-admin/(console)/tenants/[id]/page.tsx
/** SaaS tenant detail. */
import { getTenantDetail } from "@/actions/super-admin/tenants";
import { PageHeading } from "@/components/super-admin/page-heading";
import { TenantDetailView } from "@/components/super-admin/tenants/tenant-detail-view";
import { Card, CardContent } from "@/components/ui/card";
import { isSaas } from "@/lib/deployment/mode";
import { getSystemSetting } from "@/lib/settings/service";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Tenant" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TenantDetailPage({ params }: PageProps) {
  if (!isSaas()) redirect("/super-admin/installation");
  const { id } = await params;
  const [result, timeZone] = await Promise.all([
    getTenantDetail(id),
    getSystemSetting("general.timezone"),
  ]);
  const back = (
    <Link
      href="/super-admin/tenants"
      className="text-primary text-[0.8125rem] hover:underline"
    >
      ← All tenants
    </Link>
  );
  if (!result.success || !result.data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeading eyebrow={back} title="Tenant" />
        <Card>
          <CardContent className="text-muted-foreground py-16 text-center">
            {result.error ?? "Tenant information not found."}
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow={back}
        title="Tenant"
        subtitle="Profile, lifecycle, administrators and usage of this tenant."
      />
      <TenantDetailView detail={result.data} saas timeZone={timeZone} />
    </div>
  );
}
