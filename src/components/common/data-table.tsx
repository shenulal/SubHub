"use client";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns,
} from "lucide-react";
import * as React from "react";

/**
 * Sort direction type
 */
export type SortDirection = "asc" | "desc" | null;

/**
 * Column definition
 */
export interface DataTableColumn<T> {
  id: string;
  header: string | (() => React.ReactNode);
  accessorKey?: keyof T;
  accessorFn?: (row: T) => React.ReactNode;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
  visible?: boolean;
  className?: string;
  headerClassName?: string;
}

/**
 * Sort state
 */
export interface SortState {
  columnId: string;
  direction: SortDirection;
}

/**
 * Pagination state
 */
export interface PaginationState {
  pageIndex: number;
  pageSize: number;
}

/**
 * DataTable Props
 */
interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  // Row selection
  enableRowSelection?: boolean;
  selectedRows?: Set<string>;
  onSelectedRowsChange?: (selectedRows: Set<string>) => void;
  // Column visibility
  enableColumnVisibility?: boolean;
  columnVisibility?: Record<string, boolean>;
  onColumnVisibilityChange?: (columnId: string, visible: boolean) => void;
  // Sorting
  enableSorting?: boolean;
  sortState?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  // Pagination
  enablePagination?: boolean;
  pagination?: PaginationState;
  onPaginationChange?: (pagination: PaginationState) => void;
  totalCount?: number;
  pageSizeOptions?: number[];
  // Other
  emptyMessage?: string;
  className?: string;
  isLoading?: boolean;
  hideToolbar?: boolean;
  /** Content shown on the left of the toolbar (e.g. filter buttons). Rendered on the same row as the Columns dropdown */
  toolbarLeft?: React.ReactNode;
  /** When true, hides the "1-10 of 10 items" footer text (avoids duplication with server-side pagination) */
  hideFooterItemCount?: boolean;
}

/**
 * Advanced data table component
 * - Row selection (checkboxes)
 * - Column visibility toggle
 * - Sorting
 * - Pagination
 */
export function DataTable<T>({
  data,
  columns,
  getRowId,
  // Row selection
  enableRowSelection = false,
  selectedRows = new Set(),
  onSelectedRowsChange,
  // Column visibility
  enableColumnVisibility = false,
  columnVisibility = {},
  onColumnVisibilityChange,
  // Sorting
  enableSorting = false,
  sortState = null,
  onSortChange,
  // Pagination
  enablePagination = false,
  pagination = { pageIndex: 0, pageSize: 10 },
  onPaginationChange,
  totalCount,
  pageSizeOptions = [10, 20, 30, 50, 100],
  // Other
  emptyMessage = "No data available",
  className,
  isLoading = false,
  hideToolbar = false,
  toolbarLeft,
  hideFooterItemCount = false,
}: DataTableProps<T>) {
  // Filter to visible columns
  const visibleColumns = React.useMemo(() => {
    return columns.filter((col) => {
      if (!enableColumnVisibility) return col.visible !== false;
      return columnVisibility[col.id] !== false;
    });
  }, [columns, columnVisibility, enableColumnVisibility]);

  // Compute select-all state
  const allRowIds = React.useMemo(() => data.map(getRowId), [data, getRowId]);
  const isAllSelected =
    allRowIds.length > 0 && allRowIds.every((id) => selectedRows.has(id));
  const isSomeSelected = allRowIds.some((id) => selectedRows.has(id));

  // Select/deselect all handler
  const handleSelectAll = (checked: boolean) => {
    if (!onSelectedRowsChange) return;
    if (checked) {
      onSelectedRowsChange(new Set(allRowIds));
    } else {
      onSelectedRowsChange(new Set());
    }
  };

  // Single-row select/deselect handler
  const handleSelectRow = (rowId: string, checked: boolean) => {
    if (!onSelectedRowsChange) return;
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(rowId);
    } else {
      newSelected.delete(rowId);
    }
    onSelectedRowsChange(newSelected);
  };

  // Sort handler
  const handleSort = (columnId: string) => {
    if (!onSortChange) return;
    if (sortState?.columnId === columnId) {
      if (sortState.direction === "asc") {
        onSortChange({ columnId, direction: "desc" });
      } else if (sortState.direction === "desc") {
        onSortChange(null);
      } else {
        onSortChange({ columnId, direction: "asc" });
      }
    } else {
      onSortChange({ columnId, direction: "asc" });
    }
  };

  // Render sort icon
  const renderSortIcon = (columnId: string) => {
    if (sortState?.columnId !== columnId) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    if (sortState.direction === "asc") {
      return <ArrowUp className="ml-2 h-4 w-4" />;
    }
    if (sortState.direction === "desc") {
      return <ArrowDown className="ml-2 h-4 w-4" />;
    }
    return <ArrowUpDown className="ml-2 h-4 w-4" />;
  };

  // Pagination maths
  const total = totalCount ?? data.length;
  const totalPages = Math.ceil(total / pagination.pageSize);
  const currentPage = pagination.pageIndex + 1;
  const startItem = pagination.pageIndex * pagination.pageSize + 1;
  const endItem = Math.min(
    (pagination.pageIndex + 1) * pagination.pageSize,
    total
  );

  // Render cell content
  const renderCellContent = (
    column: DataTableColumn<T>,
    row: T
  ): React.ReactNode => {
    if (column.cell) {
      return column.cell(row);
    }
    if (column.accessorFn) {
      return column.accessorFn(row);
    }
    if (column.accessorKey) {
      return String(row[column.accessorKey] ?? "");
    }
    return null;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Top toolbar (toolbarLeft, e.g. match-status filter, + Columns) */}
      {(enableColumnVisibility || toolbarLeft) && !hideToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          {toolbarLeft ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {toolbarLeft}
            </div>
          ) : (
            <div />
          )}
          {enableColumnVisibility && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0">
                  <Columns className="size-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns
                  .filter((column) => typeof column.header === "string")
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={columnVisibility[column.id] !== false}
                      onCheckedChange={(checked) =>
                        onColumnVisibilityChange?.(column.id, checked)
                      }
                    >
                      {column.header as string}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {/* Table */}
      <div
        data-slot="data-table-panel"
        className="bg-card min-w-0 overflow-hidden rounded-md border"
      >
        <div className="min-w-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {enableRowSelection && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                      {...(isSomeSelected && !isAllSelected
                        ? { "data-state": "indeterminate" }
                        : {})}
                    />
                  </TableHead>
                )}
                {visibleColumns.map((column) => {
                  const headerContent =
                    typeof column.header === "function"
                      ? column.header()
                      : column.header;
                  return (
                    <TableHead
                      key={column.id}
                      className={cn(column.headerClassName)}
                    >
                      {enableSorting && column.sortable ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="data-[state=open]:bg-accent hover:text-primary -ml-3 h-8 hover:bg-transparent"
                          onClick={() => handleSort(column.id)}
                        >
                          {headerContent}
                          {renderSortIcon(column.id)}
                        </Button>
                      ) : (
                        headerContent
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={
                      visibleColumns.length + (enableRowSelection ? 1 : 0)
                    }
                    className="text-muted-foreground h-24 text-center"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={
                      visibleColumns.length + (enableRowSelection ? 1 : 0)
                    }
                    className="text-muted-foreground h-24 text-center"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row) => {
                  const rowId = getRowId(row);
                  const isSelected = selectedRows.has(rowId);
                  return (
                    <TableRow
                      key={rowId}
                      data-state={isSelected ? "selected" : undefined}
                      className="transition-colors"
                    >
                      {enableRowSelection && (
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              handleSelectRow(rowId, !!checked)
                            }
                            aria-label="Select row"
                          />
                        </TableCell>
                      )}
                      {visibleColumns.map((column) => (
                        <TableCell key={column.id} className={column.className}>
                          {renderCellContent(column, row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Bottom pagination and selection info (hideFooterItemCount hides the whole footer for server-side pagination) */}
          {(!hideFooterItemCount || enablePagination) && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
              {!hideFooterItemCount && (
                <div className="text-muted-foreground min-w-0 flex-1 text-[0.8125rem] whitespace-nowrap">
                  {enableRowSelection ? (
                    <span>
                      {selectedRows.size} of {total} row(s) selected.
                    </span>
                  ) : (
                    <span>
                      {startItem}-{endItem} of {total} items
                    </span>
                  )}
                </div>
              )}
              {hideFooterItemCount && !enablePagination && (
                <div className="flex-1" />
              )}

              {enablePagination && (
                <div className="flex flex-wrap items-center gap-4 lg:gap-6">
                  <div className="flex items-center gap-2">
                    <p className="text-muted-foreground text-[0.8125rem] whitespace-nowrap">
                      Rows per page
                    </p>
                    <Select
                      value={pagination.pageSize.toString()}
                      onValueChange={(value) =>
                        onPaginationChange?.({
                          pageIndex: 0,
                          pageSize: Number(value),
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue
                          placeholder={pagination.pageSize.toString()}
                        />
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
                  <div className="flex items-center gap-2">
                    <div className="text-foreground flex min-w-[100px] items-center justify-center text-[0.8125rem] whitespace-nowrap tabular-nums">
                      Page {currentPage} of {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        onPaginationChange?.({
                          ...pagination,
                          pageIndex: pagination.pageIndex - 1,
                        })
                      }
                      disabled={pagination.pageIndex <= 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        onPaginationChange?.({
                          ...pagination,
                          pageIndex: pagination.pageIndex + 1,
                        })
                      }
                      disabled={currentPage >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * useDataTable hook - manages table state
 */
export function useDataTable({
  defaultPageSize = 10,
}: {
  defaultPageSize?: number;
} = {}) {
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(
    new Set()
  );
  const [columnVisibility, setColumnVisibility] = React.useState<
    Record<string, boolean>
  >({});
  const [sortState, setSortState] = React.useState<SortState | null>(null);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
  });

  const handleColumnVisibilityChange = React.useCallback(
    (columnId: string, visible: boolean) => {
      setColumnVisibility((prev) => ({
        ...prev,
        [columnId]: visible,
      }));
    },
    []
  );

  const clearSelection = React.useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  const resetPagination = React.useCallback(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  return {
    selectedRows,
    setSelectedRows,
    columnVisibility,
    setColumnVisibility,
    handleColumnVisibilityChange,
    sortState,
    setSortState,
    pagination,
    setPagination,
    clearSelection,
    resetPagination,
  };
}
