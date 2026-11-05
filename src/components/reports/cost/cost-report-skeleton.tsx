import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton that renders four KPI cards
 * Mirrors the structure of the real KPI card layout
 */
export function KpiCardsSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="transition-all">
          <CardContent className="flex h-full flex-col justify-between px-4 py-1.5">
            <div className="flex items-center gap-2">
              {/* Icon placeholder */}
              <Skeleton className="size-10 rounded-md" />
              {/* Label */}
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="mt-2">
              {/* Value (large number) */}
              <Skeleton className="h-8 w-24" />
              {/* Subtext */}
              <Skeleton className="mt-1 h-3 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Chart card skeleton (MonthlyTrendChart loading state)
 * Made up of a header, filter area and chart area
 */
export function ChartCardSkeleton() {
  return (
    <Card className="min-h-[450px]">
      <CardHeader className="border-b pb-4">
        <div className="flex items-center justify-between">
          <div>
            {/* Title */}
            <Skeleton className="h-6 w-32" />
            {/* Description */}
            <Skeleton className="mt-2 h-4 w-48" />
          </div>
          <div className="flex items-center gap-2">
            {/* Filter toggle buttons */}
            <Skeleton className="h-10 w-[130px]" />
            <Skeleton className="h-10 w-[130px]" />
            <Skeleton className="h-10 w-[70px]" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Chart area */}
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  );
}

/**
 * Table card skeleton (cost-by-app distribution and cost anomaly sections)
 * Row count is configurable via the rowCount prop
 */
export function TableCardSkeleton({
  rowCount = 5,
  title = true,
}: {
  rowCount?: number;
  title?: boolean;
}) {
  return (
    <Card className="min-h-[450px]">
      {title && (
        <CardHeader className="border-b pb-4">
          <div>
            {/* Title */}
            <Skeleton className="h-6 w-32" />
            {/* Description */}
            <Skeleton className="mt-2 h-4 w-48" />
          </div>
        </CardHeader>
      )}
      <CardContent className="pt-6">
        <div className="space-y-3">
          {Array.from({ length: rowCount }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              {/* Icon/checkbox */}
              <Skeleton className="size-10 rounded-md" />
              {/* Name */}
              <Skeleton className="h-4 w-32" />
              {/* Badge */}
              <Skeleton className="h-5 w-16" />
              {/* Amount */}
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Filter bar skeleton (TeamUserFilterRouter loading state)
 * Placeholders for the team and user filters
 */
export function FilterBarSkeleton() {
  return (
    <div className="flex items-center gap-2">
      {/* Team picker */}
      <Skeleton className="h-10 w-[180px]" />
      {/* User picker */}
      <Skeleton className="h-10 w-[180px]" />
    </div>
  );
}

/**
 * Full SeatAnalysisSection skeleton
 * Includes the waste analysis and optimisation suggestion sections
 */
export function SeatAnalysisSkeleton() {
  return (
    <div className="space-y-6">
      {/* Divider */}
      <Separator className="my-6" />

      {/* Waste analysis section header */}
      <div>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>

      {/* Three waste KPI cards */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Waste table */}
      <TableCardSkeleton rowCount={5} title={false} />

      {/* Optimisation suggestions section header */}
      <div className="mt-8">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>

      {/* Three optimisation KPI cards */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Optimisation table */}
      <TableCardSkeleton rowCount={5} title={false} />
    </div>
  );
}

/**
 * Full-page skeleton (used by loading.tsx)
 * Combines all skeleton components into the full page layout
 */
export function CostReportPageSkeleton() {
  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-28" />
      </div>

      {/* KPI cards */}
      <KpiCardsSkeleton />

      {/* Filter bar */}
      <FilterBarSkeleton />

      {/* Monthly cost trend chart */}
      <ChartCardSkeleton />

      {/* Cost by app + cost anomalies */}
      <div className="grid gap-6 xl:grid-cols-2">
        <TableCardSkeleton rowCount={5} />
        <TableCardSkeleton rowCount={5} />
      </div>

      {/* Seat analysis section */}
      <SeatAnalysisSkeleton />
    </div>
  );
}
