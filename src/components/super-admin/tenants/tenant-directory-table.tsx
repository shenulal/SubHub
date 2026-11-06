// src/components/super-admin/tenants/tenant-directory-table.tsx
/** SaaS tenant list: usage, status, last activity; rows open the tenant detail. */
import type { TenantDirectoryRow } from "@/actions/super-admin/tenants";
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
import { formatCount, formatPanelDate } from "../format";

export function TenantDirectoryTable({
  rows,
  timeZone,
  filtered,
}: {
  rows: TenantDirectoryRow[];
  timeZone: string;
  filtered: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground flex h-32 items-center justify-center text-[0.875rem]">
        {filtered
          ? "No tenants match the filters."
          : "No tenants yet. Create the first one."}
      </div>
    );
  }
  return (
    <Table data-testid="tenant-directory">
      <TableHeader>
        <TableRow>
          <TableHead>Tenant</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Users</TableHead>
          <TableHead className="text-right">Admins</TableHead>
          <TableHead className="text-right">Subscriptions</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Last activity</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="max-w-[280px]">
              <Link
                href={`/super-admin/tenants/${t.id}`}
                className="text-primary block truncate font-medium hover:underline"
                title={t.name}
              >
                {t.name}
              </Link>
              <span className="text-muted-foreground block truncate text-[0.8125rem]">
                {t.domain ?? "No domain"}
              </span>
            </TableCell>
            <TableCell>
              <Badge variant={t.deactivatedAt ? "warning" : "success"}>
                {t.deactivatedAt ? "Suspended" : "Active"}
              </Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCount(t.userCount)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCount(t.adminCount)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCount(t.subscriptionCount)}
            </TableCell>
            <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
              {formatPanelDate(t.createdAt, timeZone)}
            </TableCell>
            <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
              {formatPanelDate(t.lastActivityAt, timeZone)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
