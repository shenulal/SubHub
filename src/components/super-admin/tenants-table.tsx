// src/components/super-admin/tenants-table.tsx
/** SaaS console: every tenant with usage counts, status and lifecycle actions. */
import type { TenantInfo } from "@/actions/super-admin/tenant-settings";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { TenantStatusButton } from "./tenant-status-button";

export function TenantsTable({ tenants }: { tenants: TenantInfo[] }) {
  if (tenants.length === 0) {
    return (
      <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
        No tenants yet.
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tenant</TableHead>
          <TableHead>Domain</TableHead>
          <TableHead className="text-right">Users</TableHead>
          <TableHead className="text-right">Subscriptions</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tenants.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="max-w-[240px]">
              <Link
                href={`/super-admin/tenants/${t.id}`}
                className="text-primary block truncate font-medium hover:underline"
                title={t.name}
              >
                {t.name}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground max-w-[200px] truncate">
              {t.domain ?? "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {t.userCount.toLocaleString("en-US")}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {t.subscriptionCount.toLocaleString("en-US")}
            </TableCell>
            <TableCell className="whitespace-nowrap tabular-nums">
              {new Date(t.createdAt).toLocaleDateString("en-US")}
            </TableCell>
            <TableCell>
              <Badge variant={t.deactivatedAt ? "error" : "success"}>
                {t.deactivatedAt ? "Deactivated" : "Active"}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <TenantStatusButton
                tenantId={t.id}
                tenantName={t.name}
                deactivated={Boolean(t.deactivatedAt)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
