// src/app/super-admin/(console)/installation/page.tsx
/**
 * Single-tenant (on-premise / self-hosted): the installation and its one
 * organisation. First-run setup creates it from here when none exists; a second
 * organisation stays blocked. SaaS installations use Tenants instead.
 */
import { getTenantFormOptions } from "@/actions/super-admin/tenant-form-options";
import {
  getInstallationTenantId,
  getTenantDetail,
} from "@/actions/super-admin/tenants";
import { PageHeading } from "@/components/super-admin/page-heading";
import { CreateTenantForm } from "@/components/super-admin/tenants/create-tenant-form";
import { TenantDetailView } from "@/components/super-admin/tenants/tenant-detail-view";
import { isSaas } from "@/lib/deployment/mode";
import { getSystemSetting } from "@/lib/settings/service";
import { Info } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Installation" };

function SingleTenantNotice({ installationId }: { installationId: string }) {
  return (
    <div
      className="tonal-info flex min-w-0 items-start gap-3 rounded-md p-4 text-[0.875rem]"
      data-testid="single-tenant-notice"
    >
      <Info className="mt-0.5 size-4 shrink-0" />
      <p className="min-w-0">
        This is a single-tenant (on-premise / self-hosted) installation: it
        holds exactly one organisation, so creating a second tenant is disabled.
        Multi-tenant operation needs{" "}
        <code className="font-mono">SUBHUB_DEPLOYMENT_MODE=saas</code>.
        Installation ID{" "}
        <code className="font-mono break-all">{installationId}</code>.
      </p>
    </div>
  );
}

async function FirstRunSetup({ installationId }: { installationId: string }) {
  const options = await getTenantFormOptions();
  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Installation"
        subtitle="First-run setup: this installation has no organisation yet. Create it and its first Tenant Admin."
      />
      <SingleTenantNotice installationId={installationId} />
      {options.success && options.data && (
        <CreateTenantForm
          {...options.data}
          detailHref="/super-admin/installation"
        />
      )}
    </div>
  );
}

export default async function InstallationPage() {
  if (isSaas()) redirect("/super-admin/tenants");
  const [tenant, timeZone] = await Promise.all([
    getInstallationTenantId(),
    getSystemSetting("general.timezone"),
  ]);
  if (!tenant.success || !tenant.data) {
    return (
      <p className="tonal-error rounded-md p-3 text-[0.875rem]">
        {tenant.error}
      </p>
    );
  }
  const { organizationId, installationId } = tenant.data;
  if (!organizationId) return <FirstRunSetup installationId={installationId} />;
  const detail = await getTenantDetail(organizationId);
  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Installation"
        subtitle="The organisation of this on-premise / self-hosted installation and its administrators."
      />
      <SingleTenantNotice installationId={installationId} />
      {detail.success && detail.data ? (
        <TenantDetailView
          detail={detail.data}
          saas={false}
          timeZone={timeZone}
        />
      ) : (
        <p className="tonal-error rounded-md p-3 text-[0.875rem]">
          {detail.error}
        </p>
      )}
    </div>
  );
}
