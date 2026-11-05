import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 🎯 Purpose: Apply forwardRef to the Skeleton component for React 18/19 compatibility
 * 📝 Note: The animate-pulse animation must be kept
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const Skeleton = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="skeleton"
        className={cn("bg-accent animate-pulse rounded-md", className)}
        {...props}
      />
    );
  },
);
Skeleton.displayName = "Skeleton";

export { Skeleton };
