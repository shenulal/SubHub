import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 🎯 목적: Tabs 컴포넌트에 forwardRef 적용하여 React 18/19 호환성 제공
 * 📝 주의사항: Radix UI Tabs.Root primitive 사용
 * 🔄 변경이력: 2025-10-11 - React 18/19 dual support를 위한 forwardRef 추가
 */
const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <TabsPrimitive.Root
      ref={ref}
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
});
Tabs.displayName = "Tabs";

/**
 * 🎯 목적: TabsList 컴포넌트에 forwardRef 적용
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  return (
    <TabsPrimitive.List
      ref={ref}
      data-slot="tabs-list"
      className={cn(
        "text-muted-foreground border-border inline-flex h-10 w-fit max-w-full items-center justify-start gap-1 overflow-x-auto border-b",
        className,
      )}
      {...props}
    />
  );
});
TabsList.displayName = "TabsList";

/**
 * 🎯 목적: TabsTrigger 컴포넌트에 forwardRef 적용
 * 📝 주의사항: state에 따라 active 스타일 적용
 */
const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      data-slot="tabs-trigger"
      className={cn(
        "focus-visible:ring-ring/50 focus-visible:outline-ring text-muted-foreground hover:text-primary data-[state=active]:text-primary data-[state=active]:after:bg-primary relative inline-flex h-full shrink-0 items-center justify-center gap-1.5 px-4 text-[0.9375rem] font-medium whitespace-nowrap transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-transparent focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = "TabsTrigger";

/**
 * 🎯 목적: TabsContent 컴포넌트에 forwardRef 적용
 */
const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => {
  return (
    <TabsPrimitive.Content
      ref={ref}
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
});
TabsContent.displayName = "TabsContent";

export { Tabs, TabsContent, TabsList, TabsTrigger };
