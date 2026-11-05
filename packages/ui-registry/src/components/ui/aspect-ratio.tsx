"use client";

import { AspectRatio as AspectRatioPrimitive } from "radix-ui";
import * as React from "react";

/**
 * 🎯 Purpose: Apply forwardRef to the AspectRatio component for React 18/19 compatibility
 * 📝 Note: Uses the Radix UI AspectRatio.Root primitive
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const AspectRatio = React.forwardRef<
  React.ElementRef<typeof AspectRatioPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AspectRatioPrimitive.Root>
>((props, ref) => {
  return (
    <AspectRatioPrimitive.Root ref={ref} data-slot="aspect-ratio" {...props} />
  );
});
AspectRatio.displayName = "AspectRatio";

export { AspectRatio };
