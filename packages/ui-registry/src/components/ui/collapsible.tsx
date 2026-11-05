"use client";

import { Collapsible as CollapsiblePrimitive } from "radix-ui";
import * as React from "react";

/**
 * 🎯 Purpose: Apply forwardRef to the Collapsible component for React 18/19 compatibility
 * 📝 Note: Uses the Radix UI Collapsible.Root primitive
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const Collapsible = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Root>
>((props, ref) => {
  return (
    <CollapsiblePrimitive.Root ref={ref} data-slot="collapsible" {...props} />
  );
});
Collapsible.displayName = "Collapsible";

/**
 * 🎯 Purpose: Apply forwardRef to the CollapsibleTrigger component
 */
const CollapsibleTrigger = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.CollapsibleTrigger>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleTrigger>
>((props, ref) => {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      ref={ref}
      data-slot="collapsible-trigger"
      {...props}
    />
  );
});
CollapsibleTrigger.displayName = "CollapsibleTrigger";

/**
 * 🎯 Purpose: Apply forwardRef to the CollapsibleContent component
 */
const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.CollapsibleContent>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleContent>
>((props, ref) => {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      ref={ref}
      data-slot="collapsible-content"
      {...props}
    />
  );
});
CollapsibleContent.displayName = "CollapsibleContent";

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
