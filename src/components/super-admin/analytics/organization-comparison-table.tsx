// src/components/super-admin/analytics/organization-comparison-table.tsx
/** Platform view: one row per organisation; each row opens its analytics. */
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OrganizationComparisonRow } from "@/types/platform-analytics";
import Link from "next/link";

import { formatCount, formatPanelDate } from "../format";
import { money } from "./analytics-format";

interface Props {
  rows: OrganizationComparisonRow[];
  currency: string;
  period: string;
  timeZone: string;
}

const NUM = "text-right tabular-nums whitespace-nowrap";

export function OrganizationComparisonTable({
  rows,
  currency,
  period,
  timeZone,
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground flex h-32 items-center justify-center text-[0.875rem]">
        No organisations yet.
      </div>
    );
  }
  const href = (id: string) =>
    `/super-admin?org=${encodeURIComponent(id)}&period=${encodeURIComponent(period)}`;
  return (
    <Table data-testid="analytics-organizations">
      <TableHeader>
        <TableRow>
          <TableHead>Organisation</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Users</TableHead>
          <TableHead className="text-right">Active users</TableHead>
          <TableHead className="text-right">Subscriptions</TableHead>
          <TableHead className="text-right">Monthly spend</TableHead>
          <TableHead className="text-right">Pending approvals</TableHead>
          <TableHead>Last activity</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="max-w-[260px]">
              <Link
                href={href(r.id)}
                className="text-primary block truncate font-medium hover:underline"
                title={`View analytics for ${r.name}`}
              >
                {r.name}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant={r.status === "suspended" ? "warning" : "success"}>
                {r.status === "suspended" ? "Suspended" : "Active"}
              </Badge>
            </TableCell>
            <TableCell className={NUM}>{formatCount(r.users)}</TableCell>
            <TableCell
              className={NUM}
              title={`${r.signedInUsers} signed in during the period`}
            >
              {formatCount(r.activeUsers)}
            </TableCell>
            <TableCell className={NUM}>
              {formatCount(r.activeSubscriptions)}
            </TableCell>
            <TableCell className={NUM}>
              {money(r.monthlySpend, currency)}
            </TableCell>
            <TableCell className={NUM}>
              {formatCount(r.pendingApprovals)}
            </TableCell>
            <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
              {formatPanelDate(r.lastActivityAt, timeZone)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
