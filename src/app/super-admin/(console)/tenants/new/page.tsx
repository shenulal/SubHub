// src/app/super-admin/(console)/tenants/new/page.tsx
/** SaaS: create a tenant with its first Tenant Admin. */
import { getTenantFormOptions } from "@/actions/super-admin/tenant-form-options";
import { PageHeading } from "@/components/super-admin/page-heading";
import { CreateTenantForm } from "@/components/super-admin/tenants/create-tenant-form";
import { isSaas } from "@/lib/deployment/mode";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Create tenant" };

export default async function NewTenantPage() {
  if (!isSaas()) redirect("/super-admin/installation");
  const options = await getTenantFormOptions();
  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6">
      <PageHeading
        eyebrow={
          <Link
            href="/super-admin/tenants"
            className="text-primary text-[0.8125rem] hover:underline"
          >
            ← All tenants
          </Link>
        }
        title="Create tenant"
        subtitle="Creates the organisation with default roles and master data, and gives its first Tenant Admin access."
      />
      {options.success && options.data ? (
        <CreateTenantForm
          {...options.data}
          detailHref="/super-admin/tenants/{id}"
        />
      ) : (
        <p className="tonal-error rounded-md p-3 text-[0.875rem]">
          {options.error}
        </p>
      )}
    </div>
  );
}
