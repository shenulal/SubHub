// src/app/super-admin/(console)/tenant/page.tsx
// Legacy URL of the console's tenant screen: forwards to Tenants (SaaS) or
// Installation (single-tenant), keeping a selected tenant.
import { isSaas } from "@/lib/deployment/mode";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ org?: string }>;
}

export default async function LegacyTenantPage({ searchParams }: PageProps) {
  const { org } = await searchParams;
  if (!isSaas()) redirect("/super-admin/installation");
  redirect(
    org
      ? `/super-admin/tenants/${encodeURIComponent(org)}`
      : "/super-admin/tenants"
  );
}
