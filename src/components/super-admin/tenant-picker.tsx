// src/components/super-admin/tenant-picker.tsx
"use client";

/** SaaS console: choose which tenant a screen works on (`?org=<id>`). */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePathname, useRouter } from "next/navigation";

export interface TenantOption {
  id: string;
  name: string;
  deactivated?: boolean;
}

export function TenantPicker({
  tenants,
  value,
}: {
  tenants: TenantOption[];
  value?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Select
      value={value}
      onValueChange={(id) =>
        router.push(`${pathname}?org=${encodeURIComponent(id)}`)
      }
    >
      <SelectTrigger className="w-full sm:w-[320px]" aria-label="Tenant">
        <SelectValue placeholder="Select a tenant" />
      </SelectTrigger>
      <SelectContent searchPlaceholder="Search tenants" emptyText="No tenants">
        {tenants.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.deactivated ? `${t.name} (deactivated)` : t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
