import { ChevronRight, MoreHorizontal } from "lucide-react";
import { Slot as SlotPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 🎯 Purpose: Apply forwardRef to the Breadcrumb component for React 18/19 compatibility
 * 📝 Note: The aria-label="breadcrumb" accessibility attribute must be kept
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const Breadcrumb = React.forwardRef<HTMLElement, React.ComponentProps<"nav">>(
  ({ ...props }, ref) => {
    return (
      <nav
        ref={ref}
        aria-label="breadcrumb"
        data-slot="breadcrumb"
        {...props}
      />
    );
  },
);
Breadcrumb.displayName = "Breadcrumb";

/**
 * 🎯 Purpose: Apply forwardRef to the BreadcrumbList component
 * 📝 Note: Uses an ol tag; keep the flex layout
 */
const BreadcrumbList = React.forwardRef<
  HTMLOListElement,
  React.ComponentProps<"ol">
>(({ className, ...props }, ref) => {
  return (
    <ol
      ref={ref}
      data-slot="breadcrumb-list"
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5",
        className,
      )}
      {...props}
    />
  );
});
BreadcrumbList.displayName = "BreadcrumbList";

/**
 * 🎯 Purpose: Apply forwardRef to the BreadcrumbItem component
 */
const BreadcrumbItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => {
  return (
    <li
      ref={ref}
      data-slot="breadcrumb-item"
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props}
    />
  );
});
BreadcrumbItem.displayName = "BreadcrumbItem";

/**
 * 🎯 Purpose: Apply forwardRef to the BreadcrumbLink component
 * 📝 Note: Supports the asChild pattern (Radix UI Slot compatible)
 */
const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<"a"> & {
    asChild?: boolean;
  }
>(({ asChild, className, ...props }, ref) => {
  const Comp = asChild ? SlotPrimitive.Slot : "a";

  return (
    <Comp
      ref={ref}
      data-slot="breadcrumb-link"
      className={cn("hover:text-foreground transition-colors", className)}
      {...props}
    />
  );
});
BreadcrumbLink.displayName = "BreadcrumbLink";

/**
 * 🎯 Purpose: Apply forwardRef to the BreadcrumbPage component
 * 📝 Note: Keep the aria-current="page" accessibility attribute
 */
const BreadcrumbPage = React.forwardRef<
  HTMLSpanElement,
  React.ComponentProps<"span">
>(({ className, ...props }, ref) => {
  return (
    <span
      ref={ref}
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("text-foreground font-normal", className)}
      {...props}
    />
  );
});
BreadcrumbPage.displayName = "BreadcrumbPage";

/**
 * 🎯 Purpose: Apply forwardRef to the BreadcrumbSeparator component
 * 📝 Note: Keep ChevronRight as the default icon
 */
const BreadcrumbSeparator = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ children, className, ...props }, ref) => {
  return (
    <li
      ref={ref}
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("[&>svg]:size-3.5", className)}
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  );
});
BreadcrumbSeparator.displayName = "BreadcrumbSeparator";

/**
 * 🎯 Purpose: Apply forwardRef to the BreadcrumbEllipsis component
 * 📝 Note: Keep the MoreHorizontal icon
 */
const BreadcrumbEllipsis = React.forwardRef<
  HTMLSpanElement,
  React.ComponentProps<"span">
>(({ className, ...props }, ref) => {
  return (
    <span
      ref={ref}
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn("flex size-9 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontal className="size-4" />
      <span className="sr-only">More</span>
    </span>
  );
});
BreadcrumbEllipsis.displayName = "BreadcrumbEllipsis";

export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
