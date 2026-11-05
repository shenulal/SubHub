// src/components/super-admin/resource-summary-table.tsx
import type { AppSubscriptionSummary } from "@/actions/super-admin/dashboard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Image from "next/image";

interface ResourceSummaryTableProps {
  data: AppSubscriptionSummary[];
}

export function ResourceSummaryTable({ data }: ResourceSummaryTableProps) {
  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);

  if (data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
        No active subscriptions.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>App</TableHead>
          <TableHead className="text-right">Subscriptions</TableHead>
          <TableHead className="text-right">Monthly Cost</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item) => (
          <TableRow key={item.appId}>
            <TableCell>
              <div className="flex min-w-0 items-center gap-3">
                {item.logoUrl ? (
                  <Image
                    src={item.logoUrl}
                    alt={item.appName}
                    width={30}
                    height={30}
                    className="size-[30px] shrink-0 rounded-md object-contain"
                    unoptimized
                  />
                ) : (
                  <div className="tonal-primary flex size-[30px] shrink-0 items-center justify-center rounded-md text-[0.8125rem] font-medium">
                    {item.appName.charAt(0)}
                  </div>
                )}
                <span
                  className="text-foreground max-w-[20rem] truncate font-medium"
                  title={item.appName}
                >
                  {item.appName}
                </span>
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {item.subscriptionCount}
            </TableCell>
            <TableCell className="text-foreground text-right font-medium tabular-nums">
              {formatCurrency(item.totalMonthlyCost, item.currency)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
