"use client";

import { GripVerticalIcon } from "lucide-react";
import * as React from "react";
import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/lib/utils";

/**
 * 🎯 Purpose: Apply forwardRef to the ResizablePanelGroup component for React 18/19 compatibility
 * 📝 Note: Uses react-resizable-panels' PanelGroup; supports the imperative API ref
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const ResizablePanelGroup = React.forwardRef<
  React.ElementRef<typeof ResizablePrimitive.PanelGroup>,
  React.ComponentPropsWithoutRef<typeof ResizablePrimitive.PanelGroup>
>(({ className, ...props }, ref) => {
  return (
    <ResizablePrimitive.PanelGroup
      ref={ref}
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
        className,
      )}
      {...props}
    />
  );
});
ResizablePanelGroup.displayName = "ResizablePanelGroup";

/**
 * 🎯 Purpose: Apply forwardRef to the ResizablePanel component for React 18/19 compatibility
 * 📝 Note: Uses react-resizable-panels' Panel; supports the imperative API ref
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const ResizablePanel = React.forwardRef<
  React.ElementRef<typeof ResizablePrimitive.Panel>,
  React.ComponentPropsWithoutRef<typeof ResizablePrimitive.Panel>
>((props, ref) => {
  return (
    <ResizablePrimitive.Panel
      ref={ref}
      data-slot="resizable-panel"
      {...props}
    />
  );
});
ResizablePanel.displayName = "ResizablePanel";

/**
 * 🎯 Purpose: ResizableHandle component
 * 📝 Note: react-resizable-panels' PanelResizeHandle does not support ref
 * 🔄 History: 2025-10-11 - Reviewed for React 18/19 dual support (confirmed ref is not supported)
 */
function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
}) {
  return (
    <ResizablePrimitive.PanelResizeHandle
      data-slot="resizable-handle"
      className={cn(
        "bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2 [&[data-panel-group-direction=vertical]>div]:rotate-90",
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </ResizablePrimitive.PanelResizeHandle>
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
