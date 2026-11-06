// src/components/super-admin/audit/audit-table.tsx
/** Platform audit entries (Audit page and tenant detail). */
import type { PlatformAuditRow } from "@/actions/super-admin/_audit-query";
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
import { formatPanelDate } from "../format";

function actorLabel(row: PlatformAuditRow): string {
  if (!row.actor)
    return row.metadata &&
      (row.metadata as { source?: string }).source === "cli"
      ? "Bootstrap CLI"
      : "System";
  return row.actor.name ?? row.actor.email;
}

export function AuditTable({
  rows,
  timeZone,
  showTenant = true,
  emptyText = "No platform activity recorded yet.",
}: {
  rows: PlatformAuditRow[];
  timeZone: string;
  showTenant?: boolean;
  emptyText?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground flex h-28 items-center justify-center text-[0.875rem]">
        {emptyText}
      </div>
    );
  }
  return (
    <Table data-testid="platform-audit-table">
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Actor</TableHead>
          {showTenant && <TableHead>Tenant</TableHead>}
          <TableHead>Record</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
              {formatPanelDate(row.createdAt, timeZone, true)}
            </TableCell>
            <TableCell className="max-w-[320px]">
              <span
                className="text-foreground block truncate font-medium"
                title={row.action}
              >
                {row.description}
              </span>
            </TableCell>
            <TableCell
              className="max-w-[220px] truncate"
              title={row.actor?.email}
            >
              {actorLabel(row)}
            </TableCell>
            {showTenant && (
              <TableCell className="max-w-[200px]">
                {row.tenant ? (
                  <Link
                    href={`/super-admin/tenants/${row.tenant.id}`}
                    className="text-primary block truncate hover:underline"
                    title={row.tenant.name}
                  >
                    {row.tenant.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Platform</span>
                )}
              </TableCell>
            )}
            <TableCell>
              <Badge variant="neutral">{row.entityType}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
