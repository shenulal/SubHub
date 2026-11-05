import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import * as React from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 🎯 Purpose: Apply forwardRef to the Pagination component for React 18/19 compatibility
 * 📝 Note: Uses an HTML nav element
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const Pagination = React.forwardRef<HTMLElement, React.ComponentProps<"nav">>(
  ({ className, ...props }, ref) => {
    return (
      <nav
        ref={ref}
        role="navigation"
        aria-label="pagination"
        data-slot="pagination"
        className={cn("mx-auto flex w-full justify-center", className)}
        {...props}
      />
    );
  },
);
Pagination.displayName = "Pagination";

/**
 * 🎯 Purpose: Apply forwardRef to the PaginationContent component for React 18/19 compatibility
 * 📝 Note: Uses an HTML ul element
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => {
  return (
    <ul
      ref={ref}
      data-slot="pagination-content"
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  );
});
PaginationContent.displayName = "PaginationContent";

/**
 * 🎯 Purpose: Apply forwardRef to the PaginationItem component for React 18/19 compatibility
 * 📝 Note: Uses an HTML li element
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>((props, ref) => {
  return <li ref={ref} data-slot="pagination-item" {...props} />;
});
PaginationItem.displayName = "PaginationItem";

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  React.ComponentProps<"a">;

/**
 * 🎯 Purpose: Apply forwardRef to the PaginationLink component for React 18/19 compatibility
 * 📝 Note: Uses an HTML a element; variant changes with the isActive state
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const PaginationLink = React.forwardRef<HTMLAnchorElement, PaginationLinkProps>(
  ({ className, isActive, size = "icon", ...props }, ref) => {
    return (
      <a
        ref={ref}
        aria-current={isActive ? "page" : undefined}
        data-slot="pagination-link"
        data-active={isActive}
        className={cn(
          buttonVariants({
            variant: isActive ? "outline" : "ghost",
            size,
          }),
          className,
        )}
        {...props}
      />
    );
  },
);
PaginationLink.displayName = "PaginationLink";

/**
 * 🎯 Purpose: Apply forwardRef to the PaginationPrevious component for React 18/19 compatibility
 * 📝 Note: Uses the PaginationLink component (already supports forwardRef)
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const PaginationPrevious = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<typeof PaginationLink>
>(({ className, ...props }, ref) => {
  return (
    <PaginationLink
      ref={ref}
      aria-label="Go to previous page"
      size="default"
      className={cn("gap-1 px-2.5 sm:pl-2.5", className)}
      {...props}
    >
      <ChevronLeftIcon />
      <span className="hidden sm:block">Previous</span>
    </PaginationLink>
  );
});
PaginationPrevious.displayName = "PaginationPrevious";

/**
 * 🎯 Purpose: Apply forwardRef to the PaginationNext component for React 18/19 compatibility
 * 📝 Note: Uses the PaginationLink component (already supports forwardRef)
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const PaginationNext = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<typeof PaginationLink>
>(({ className, ...props }, ref) => {
  return (
    <PaginationLink
      ref={ref}
      aria-label="Go to next page"
      size="default"
      className={cn("gap-1 px-2.5 sm:pr-2.5", className)}
      {...props}
    >
      <span className="hidden sm:block">Next</span>
      <ChevronRightIcon />
    </PaginationLink>
  );
});
PaginationNext.displayName = "PaginationNext";

/**
 * 🎯 Purpose: Apply forwardRef to the PaginationEllipsis component for React 18/19 compatibility
 * 📝 Note: Uses an HTML span element; indicates there are more pages
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const PaginationEllipsis = React.forwardRef<
  HTMLSpanElement,
  React.ComponentProps<"span">
>(({ className, ...props }, ref) => {
  return (
    <span
      ref={ref}
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn("flex size-9 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontalIcon className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  );
});
PaginationEllipsis.displayName = "PaginationEllipsis";

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
