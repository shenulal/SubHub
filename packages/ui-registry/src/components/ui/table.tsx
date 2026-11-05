import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 🎯 Purpose: Apply forwardRef to the Table component for React 18/19 compatibility
 * 📝 Note: Uses an HTML table element; includes an overflow wrapper div
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const Table = React.forwardRef<HTMLTableElement, React.ComponentProps<"table">>(
  ({ className, ...props }, ref) => {
    return (
      <div
        data-slot="table-container"
        className="relative w-full max-w-full min-w-0 overflow-x-auto"
      >
        <table
          ref={ref}
          data-slot="table"
          className={cn("w-full caption-bottom text-sm", className)}
          {...props}
        />
      </div>
    );
  },
);
Table.displayName = "Table";

/**
 * 🎯 Purpose: Apply forwardRef to the TableHeader component for React 18/19 compatibility
 * 📝 Note: Uses an HTML thead element
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentProps<"thead">
>(({ className, ...props }, ref) => {
  return (
    <thead
      ref={ref}
      data-slot="table-header"
      className={cn("bg-muted [&_tr]:border-b", className)}
      {...props}
    />
  );
});
TableHeader.displayName = "TableHeader";

/**
 * 🎯 Purpose: Apply forwardRef to the TableBody component for React 18/19 compatibility
 * 📝 Note: Uses an HTML tbody element
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentProps<"tbody">
>(({ className, ...props }, ref) => {
  return (
    <tbody
      ref={ref}
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
});
TableBody.displayName = "TableBody";

/**
 * 🎯 Purpose: Apply forwardRef to the TableFooter component for React 18/19 compatibility
 * 📝 Note: Uses an HTML tfoot element
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentProps<"tfoot">
>(({ className, ...props }, ref) => {
  return (
    <tfoot
      ref={ref}
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
});
TableFooter.displayName = "TableFooter";

/**
 * 🎯 Purpose: Apply forwardRef to the TableRow component for React 18/19 compatibility
 * 📝 Note: Uses an HTML tr element
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.ComponentProps<"tr">
>(({ className, ...props }, ref) => {
  return (
    <tr
      ref={ref}
      data-slot="table-row"
      className={cn(
        "hover:bg-accent/60 data-[state=selected]:bg-primary/[0.08] border-b transition-colors",
        className,
      )}
      {...props}
    />
  );
});
TableRow.displayName = "TableRow";

/**
 * 🎯 Purpose: Apply forwardRef to the TableHead component for React 18/19 compatibility
 * 📝 Note: Uses an HTML th element
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ComponentProps<"th">
>(({ className, ...props }, ref) => {
  return (
    <th
      ref={ref}
      data-slot="table-head"
      className={cn(
        "text-foreground h-12 px-4 text-left align-middle text-[0.8125rem] font-medium tracking-[0.2px] whitespace-nowrap uppercase [&_button]:text-[0.8125rem] [&_button]:font-medium [&_button]:tracking-[0.2px] [&_button]:uppercase [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
});
TableHead.displayName = "TableHead";

/**
 * 🎯 Purpose: Apply forwardRef to the TableCell component for React 18/19 compatibility
 * 📝 Note: Uses an HTML td element
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.ComponentProps<"td">
>(({ className, ...props }, ref) => {
  return (
    <td
      ref={ref}
      data-slot="table-cell"
      className={cn(
        "px-4 py-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
});
TableCell.displayName = "TableCell";

/**
 * 🎯 Purpose: Apply forwardRef to the TableCaption component for React 18/19 compatibility
 * 📝 Note: Uses an HTML caption element
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.ComponentProps<"caption">
>(({ className, ...props }, ref) => {
  return (
    <caption
      ref={ref}
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  );
});
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};
