"use client";

import { ChevronLeft, ChevronRight, Columns } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Column picker dropdown
 */
interface Column {
  id: string;
  label: string;
  visible: boolean;
}

interface ColumnSelectorProps {
  columns: Column[];
  onColumnChange: (columnId: string, visible: boolean) => void;
  className?: string;
}

export function ColumnSelector({
  columns,
  onColumnChange,
  className,
}: ColumnSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8", className)}>
          <Columns className="mr-2 h-4 w-4" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.visible}
            onCheckedChange={(checked) => onColumnChange(column.id, !!checked)}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Table pagination
 */
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  selectedCount?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function DataTablePagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  selectedCount = 0,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 30, 50, 100],
  className,
}: PaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-2 py-4",
        className
      )}
    >
      <div className="text-muted-foreground min-w-0 flex-1 text-[0.8125rem] whitespace-nowrap">
        {selectedCount > 0 ? (
          <span>
            {selectedCount} of {totalItems} row(s) selected.
          </span>
        ) : (
          <span>
            {startItem}-{endItem} of {totalItems} items
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4 lg:gap-6">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground text-[0.8125rem] whitespace-nowrap">
              Rows per page
            </p>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={pageSize.toString()} />
              </SelectTrigger>
              <SelectContent side="top">
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="text-foreground flex min-w-[100px] items-center justify-center text-[0.8125rem] whitespace-nowrap tabular-nums">
            Page {currentPage} of {totalPages}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Row selection checkbox
 */
interface RowSelectionProps {
  checked: boolean;
  indeterminate?: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

export function RowSelectionCheckbox({
  checked,
  indeterminate = false,
  onCheckedChange,
  className,
}: RowSelectionProps) {
  const checkboxRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (checkboxRef.current) {
      const input = checkboxRef.current.querySelector(
        'input[type="checkbox"]'
      ) as HTMLInputElement;
      if (input) {
        input.indeterminate = indeterminate;
      }
    }
  }, [indeterminate]);

  return (
    <Checkbox
      ref={checkboxRef}
      checked={indeterminate ? "indeterminate" : checked}
      onCheckedChange={onCheckedChange}
      className={className}
      aria-label="Select row"
    />
  );
}
