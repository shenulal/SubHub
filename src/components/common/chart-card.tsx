// src/components/common/chart-card.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Download, MoreVertical } from "lucide-react";
import * as React from "react";

/**
 * ChartCard Props
 */
interface ChartCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  /** Summary shown in the top-right corner */
  summary?: {
    label: string;
    value: string;
  };
  /** Custom action for the CardAction slot (e.g. ToggleGroup) */
  action?: React.ReactNode;
  /** Chart content */
  children: React.ReactNode;
  /** Additional content shown below the chart */
  footer?: React.ReactNode;
  /** Enable export */
  enableExport?: boolean;
  /** Export data (CSV format) */
  exportData?: ExportData;
  /** Export file name (without extension) */
  exportFilename?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Chart height */
  chartHeight?: number;
  /** Additional CSS classes */
  className?: string;
  /** Empty-state message */
  emptyMessage?: string;
  /** Empty-state action */
  emptyAction?: React.ReactNode;
  /** Whether there is no data */
  isEmpty?: boolean;
}

/**
 * Export data type
 */
export interface ExportData {
  headers: string[];
  rows: (string | number)[][];
}

/**
 * Build a CSV string
 */
function generateCSV(data: ExportData): string {
  const escape = (value: string | number) => {
    const str = String(value);
    if (str.includes(",") || str.includes("\n") || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = data.headers.map(escape).join(",");
  const dataRows = data.rows.map((row) => row.map(escape).join(","));

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Download a CSV file
 */
function downloadCSV(csv: string, filename: string) {
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download a JSON file
 */
function downloadJSON(data: ExportData, filename: string) {
  const jsonData = data.rows.map((row) => {
    const obj: Record<string, string | number> = {};
    data.headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });

  const json = JSON.stringify(jsonData, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Chart card component (shadcn dashboard-01 pattern)
 * - Supports the CardAction slot
 * - Gradient background + shadow-xs
 * - Export, loading and empty states
 */
export function ChartCard({
  title,
  description,
  icon,
  summary,
  action,
  children,
  footer,
  enableExport = false,
  exportData,
  exportFilename = "chart-data",
  isLoading = false,
  chartHeight = 200,
  className,
  emptyMessage = "No data available.",
  emptyAction,
  isEmpty = false,
}: ChartCardProps) {
  const handleExportCSV = () => {
    if (exportData) {
      const csv = generateCSV(exportData);
      downloadCSV(csv, exportFilename);
    }
  };

  const handleExportJSON = () => {
    if (exportData) {
      downloadJSON(exportData, exportFilename);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn(className)} data-testid="chart-card-skeleton">
        <CardHeader>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {icon && <Skeleton className="h-5 w-5" />}
              <Skeleton className="h-5 w-24" />
            </div>
            {description && <Skeleton className="h-4 w-32" />}
          </div>
          {summary && (
            <CardAction>
              <div className="text-right">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="mt-1 h-5 w-16" />
              </div>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full" style={{ height: chartHeight }} />
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (isEmpty) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle className="flex min-w-0 items-center gap-2">
            {icon}
            <span className="truncate">{title}</span>
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div
            className="bg-muted/60 flex flex-col items-center justify-center rounded-md text-center"
            style={{ height: chartHeight }}
          >
            <p className="text-muted-foreground text-[0.9375rem]">
              {emptyMessage}
            </p>
            {emptyAction && <div className="mt-2">{emptyAction}</div>}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="truncate" title={title}>
            {title}
          </span>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        <CardAction>
          <div className="flex shrink-0 items-center gap-2">
            {action}
            {summary && (
              <div className="min-w-0 text-right">
                <p className="text-muted-foreground text-[0.8125rem] whitespace-nowrap">
                  {summary.label}
                </p>
                <p className="text-foreground font-medium whitespace-nowrap tabular-nums">
                  {summary.value}
                </p>
              </div>
            )}
            {enableExport && exportData && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-foreground rounded-full"
                    aria-label="Export options"
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportCSV}>
                    <Download className="mr-2 size-4" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportJSON}>
                    <Download className="mr-2 size-4" />
                    Export as JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="min-w-0" style={{ height: chartHeight }}>
          {children}
        </div>
        {footer && <div className="mt-4 border-t pt-4">{footer}</div>}
      </CardContent>
    </Card>
  );
}

/**
 * ChartCardFooter - summary shown below the chart
 */
interface ChartCardFooterProps {
  items: {
    label: string;
    value: string | number;
    color?: string;
    variant?: "default" | "success" | "warning" | "danger";
  }[];
  columns?: 2 | 3 | 4;
}

const variantColors = {
  default: "",
  success: "text-success",
  warning: "text-warning",
  danger: "text-error",
};

export function ChartCardFooter({ items, columns = 3 }: ChartCardFooterProps) {
  const gridCols = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  };

  return (
    <div className={cn("grid gap-4 text-center", gridCols[columns])}>
      {items.map((item, index) => (
        <div key={index} className="min-w-0">
          <p
            className="text-muted-foreground truncate text-[0.8125rem]"
            title={item.label}
          >
            {item.label}
          </p>
          <p
            className={cn(
              "text-foreground truncate font-medium tabular-nums",
              item.color && `text-[${item.color}]`,
              item.variant && variantColors[item.variant]
            )}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * ChartLegend - chart legend
 */
interface ChartLegendProps {
  items: {
    label: string;
    value?: string | number;
    color: string;
    href?: string;
  }[];
  onClick?: (item: ChartLegendProps["items"][0]) => void;
}

export function ChartLegend({ items, onClick }: ChartLegendProps) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const content = (
          <div
            key={index}
            className={cn(
              "flex min-w-0 items-center justify-between gap-3 rounded-md p-2 text-[0.9375rem]",
              onClick && "hover:bg-accent/60 cursor-pointer transition-colors"
            )}
            onClick={() => onClick?.(item)}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-foreground truncate" title={item.label}>
                {item.label}
              </span>
            </div>
            {item.value !== undefined && (
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {item.value}
              </span>
            )}
          </div>
        );

        return content;
      })}
    </div>
  );
}
