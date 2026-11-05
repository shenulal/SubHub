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
  /** 우측 상단에 표시할 요약 정보 */
  summary?: {
    label: string;
    value: string;
  };
  /** CardAction 슬롯에 추가할 커스텀 액션 (e.g. ToggleGroup) */
  action?: React.ReactNode;
  /** 차트 컨텐츠 */
  children: React.ReactNode;
  /** 차트 하단에 표시할 추가 컨텐츠 */
  footer?: React.ReactNode;
  /** Export 기능 활성화 */
  enableExport?: boolean;
  /** Export 데이터 (CSV 형식) */
  exportData?: ExportData;
  /** Export 파일명 (확장자 제외) */
  exportFilename?: string;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 차트 높이 */
  chartHeight?: number;
  /** 추가 CSS 클래스 */
  className?: string;
  /** 데이터 없음 메시지 */
  emptyMessage?: string;
  /** 데이터 없음 액션 */
  emptyAction?: React.ReactNode;
  /** 데이터 없음 여부 */
  isEmpty?: boolean;
}

/**
 * Export 데이터 타입
 */
export interface ExportData {
  headers: string[];
  rows: (string | number)[][];
}

/**
 * CSV 문자열 생성
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
 * CSV 파일 다운로드
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
 * JSON 파일 다운로드
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
 * 차트 카드 컴포넌트 (shadcn dashboard-01 패턴)
 * - CardAction 슬롯 지원
 * - 그래디언트 배경 + shadow-xs
 * - Export 기능, 로딩/빈 상태 처리
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
  emptyMessage = "데이터가 없습니다.",
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

  // 로딩 상태
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

  // 빈 상태
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
                    CSV로 내보내기
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportJSON}>
                    <Download className="mr-2 size-4" />
                    JSON으로 내보내기
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
 * ChartCardFooter - 차트 하단 요약 정보
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
 * ChartLegend - 차트 범례
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
