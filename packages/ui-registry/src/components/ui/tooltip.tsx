"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 🎯 Purpose: TooltipProvider component (Radix UI Provider primitive)
 * 📝 Note: Provider primitive does not support ref
 * 🔄 History: 2025-10-11 - Reviewed for React 18/19 dual support (confirmed ref is not supported)
 */
function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

/**
 * 🎯 Purpose: Tooltip component (Radix UI Root primitive)
 * 📝 Note: Root primitive does not support ref
 * 🔄 History: 2025-10-11 - Reviewed for React 18/19 dual support (confirmed ref is not supported)
 */
function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

/**
 * 🎯 Purpose: Apply forwardRef to the TooltipTrigger component for React 18/19 compatibility
 * 📝 Note: Uses the Radix UI Trigger primitive
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>((props, ref) => {
  return (
    <TooltipPrimitive.Trigger
      ref={ref}
      data-slot="tooltip-trigger"
      {...props}
    />
  );
});
TooltipTrigger.displayName = "TooltipTrigger";

/**
 * 🎯 Purpose: Apply forwardRef to the TooltipContent component for React 18/19 compatibility
 * 📝 Note: Uses the Radix UI Content primitive; wrapped in a Portal; includes an Arrow
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 0, children, ...props }, ref) => {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md bg-[#1a0e33] px-3 py-1.5 text-xs text-[0.8125rem] text-balance text-white dark:bg-[#f7f4ff] dark:text-[#28243d]",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-[#1a0e33] fill-[#1a0e33] dark:bg-[#f7f4ff] dark:fill-[#f7f4ff]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
});
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
