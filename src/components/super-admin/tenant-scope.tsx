// src/components/super-admin/tenant-scope.tsx
/**
 * SaaS console: tenant selector row for screens that work on one tenant, and the
 * empty state shown until a tenant is chosen. Renders nothing in single-tenant mode.
 */
import { listTenants } from "@/actions/super-admin/tenant-settings";
import { Card, CardContent } from "@/components/ui/card";
import { isSaas } from "@/lib/deployment/mode";
import { Building2 } from "lucide-react";
import { TenantPicker } from "./tenant-picker";

export async function TenantScope({ selected }: { selected?: string }) {
  if (!isSaas()) return null;
  const result = await listTenants();
  const tenants = (result.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    deactivated: Boolean(t.deactivatedAt),
  }));
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <span className="text-muted-foreground text-[0.8125rem] font-medium">
        Tenant
      </span>
      <TenantPicker tenants={tenants} value={selected} />
    </div>
  );
}

export function SelectTenantCard({ purpose }: { purpose: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="tonal-primary flex size-10 items-center justify-center rounded-md">
          <Building2 className="size-5" />
        </div>
        <p className="text-muted-foreground text-[0.9375rem]">
          Select a tenant above to {purpose}.
        </p>
      </CardContent>
    </Card>
  );
}
