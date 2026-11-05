// src/components/layouts/sidebar-wrapper.tsx
"use client";

import { useEffect, useState } from "react";

import { AiAgentProvider } from "@/components/ai-agent";
import { AppHeader } from "@/components/layouts/app-header";
import { AppSidebar } from "@/components/layouts/app-sidebar";
import { WorkspaceScopeSwitch } from "@/components/layouts/workspace-scope-switch";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAiPanelStore } from "@/lib/ai/ai-panel-store";

interface SidebarWrapperProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  role?: "ADMIN" | "APPROVER" | "MEMBER" | "VIEWER" | null;
  user?: {
    name: string | null;
    email: string;
  };
}

/**
 * Sidebar loading skeleton (inset layout)
 */
function SidebarSkeleton() {
  return (
    <div className="bg-background flex h-screen w-full">
      {/* Sidebar skeleton */}
      <div className="hidden w-[260px] p-5 md:block">
        <div className="space-y-4">
          <Skeleton className="h-8 w-32" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
      </div>
      {/* Main content skeleton (inset style) */}
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-6">
        <div className="h-16">
          <Skeleton className="mt-4 h-8 w-48" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * Sidebar wrapper component
 * Renders after client-side hydration completes to avoid Radix UI ID mismatches
 */
export function SidebarWrapper({
  children,
  defaultOpen = true,
  role,
  user,
}: SidebarWrapperProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Show the skeleton during server rendering and hydration
  if (!isMounted) {
    return <SidebarSkeleton />;
  }

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar variant="sidebar" role={role} user={user} />
      <SidebarInset className="bg-background min-w-0">
        <AppHeader />
        {/* Workspace | Personal scope switch (6.4) — hidden when personal mode is off */}
        <ScopeBar />
        <MainContent>{children}</MainContent>
        <AppFooter />
      </SidebarInset>
      {/* AI Agent — Read Tool + Write Tool + approval flow */}
      <AiAgentProvider />
    </SidebarProvider>
  );
}

/** Thin bar under the header hosting the workspace/personal switch. */
function ScopeBar() {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] items-center justify-end px-6 pt-1 empty:hidden">
      <WorkspaceScopeSwitch />
    </div>
  );
}

/**
 * Main area — adjusts paddingRight when the AI panel is open
 */
function MainContent({ children }: { children: React.ReactNode }) {
  const { isOpen } = useAiPanelStore();

  return (
    <main
      className="bg-background min-w-0 flex-1 transition-[padding] duration-300"
      style={{ paddingRight: isOpen ? 416 : undefined }}
    >
      {/* Materio content area: compact width, 24px gutters */}
      <div className="mx-auto w-full max-w-[1440px] min-w-0 px-4 py-5 sm:px-6 sm:py-6">
        {children}
      </div>
    </main>
  );
}

/** Materio-style footer. Bottom padding keeps the last line clear of the AI button. */
function AppFooter() {
  return (
    <footer className="text-muted-foreground mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-2 px-6 pt-2 pb-20 text-[0.8125rem]">
      <span>
        © {new Date().getFullYear()} SubHub ·{" "}
        <span className="text-primary font-medium">HelloPixels</span>
      </span>
      <span>Subscription management for GCC enterprises</span>
    </footer>
  );
}
