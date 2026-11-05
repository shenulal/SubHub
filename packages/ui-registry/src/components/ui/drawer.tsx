"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";

/**
 * 🎯 Purpose: Drawer Root component
 * 📝 Note: vaul's Root primitive does not support ref
 */
const Drawer = DrawerPrimitive.Root;

/**
 * 🎯 Purpose: Apply forwardRef to the DrawerTrigger component for React 18/19 compatibility
 * 📝 Note: Uses the vaul Drawer.Trigger primitive
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const DrawerTrigger = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Trigger>
>((props, ref) => {
  return (
    <DrawerPrimitive.Trigger ref={ref} data-slot="drawer-trigger" {...props} />
  );
});
DrawerTrigger.displayName = "DrawerTrigger";

/**
 * 🎯 Purpose: DrawerPortal component
 * 📝 Note: Portal does not support ref
 */
const DrawerPortal = DrawerPrimitive.Portal;

/**
 * 🎯 Purpose: Apply forwardRef to the DrawerClose component for React 18/19 compatibility
 * 📝 Note: Uses the vaul Drawer.Close primitive
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const DrawerClose = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Close>
>((props, ref) => {
  return (
    <DrawerPrimitive.Close ref={ref} data-slot="drawer-close" {...props} />
  );
});
DrawerClose.displayName = "DrawerClose";

/**
 * 🎯 Purpose: Apply forwardRef to the DrawerOverlay component for React 18/19 compatibility
 * 📝 Note: Uses the vaul Drawer.Overlay primitive
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  return (
    <DrawerPrimitive.Overlay
      ref={ref}
      data-slot="drawer-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className,
      )}
      {...props}
    />
  );
});
DrawerOverlay.displayName = "DrawerOverlay";

/**
 * 🎯 Purpose: Apply forwardRef to the DrawerContent component for React 18/19 compatibility
 * 📝 Note: Uses the vaul Drawer.Content primitive; renders inside a Portal
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        ref={ref}
        data-slot="drawer-content"
        className={cn(
          "group/drawer-content bg-background fixed z-50 flex h-auto flex-col",
          "data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80vh] data-[vaul-drawer-direction=top]:rounded-b-lg data-[vaul-drawer-direction=top]:border-b",
          "data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[80vh] data-[vaul-drawer-direction=bottom]:rounded-t-lg data-[vaul-drawer-direction=bottom]:border-t",
          "data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=right]:sm:max-w-sm",
          "data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=left]:sm:max-w-sm",
          className,
        )}
        {...props}
      >
        <div className="bg-muted mx-auto mt-4 hidden h-2 w-[100px] shrink-0 rounded-full group-data-[vaul-drawer-direction=bottom]/drawer-content:block" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
});
DrawerContent.displayName = "DrawerContent";

/**
 * 🎯 Purpose: Apply forwardRef to the DrawerHeader component for React 18/19 compatibility
 * 📝 Note: Uses an HTML div element
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const DrawerHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-slot="drawer-header"
      className={cn(
        "flex flex-col gap-0.5 p-4 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center group-data-[vaul-drawer-direction=top]/drawer-content:text-center md:gap-1.5 md:text-left",
        className,
      )}
      {...props}
    />
  );
});
DrawerHeader.displayName = "DrawerHeader";

/**
 * 🎯 Purpose: Apply forwardRef to the DrawerFooter component for React 18/19 compatibility
 * 📝 Note: Uses an HTML div element
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const DrawerFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
});
DrawerFooter.displayName = "DrawerFooter";

/**
 * 🎯 Purpose: Apply forwardRef to the DrawerTitle component for React 18/19 compatibility
 * 📝 Note: Uses the vaul Drawer.Title primitive
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => {
  return (
    <DrawerPrimitive.Title
      ref={ref}
      data-slot="drawer-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  );
});
DrawerTitle.displayName = "DrawerTitle";

/**
 * 🎯 Purpose: Apply forwardRef to the DrawerDescription component for React 18/19 compatibility
 * 📝 Note: Uses the vaul Drawer.Description primitive
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => {
  return (
    <DrawerPrimitive.Description
      ref={ref}
      data-slot="drawer-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
});
DrawerDescription.displayName = "DrawerDescription";

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
};
