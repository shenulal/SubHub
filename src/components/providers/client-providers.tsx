"use client";

import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";

import { accessControlProvider } from "@/providers/access-control-provider";
import { authProvider } from "@/providers/auth-provider";
import { dataProvider } from "@/providers/data-provider";
import { i18nProvider } from "@/providers/i18n-provider";

interface ClientProvidersProps {
  children: ReactNode;
}

/**
 * Refine + next-themes provider wrapper.
 * - RootLayout stays a Server Component; client providers live here.
 * - Resource definitions will be injected later to match the actual routes.
 */
export function ClientProviders({ children }: ClientProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  const isRefineEnabled =
    (typeof process.env.NEXT_PUBLIC_ENABLE_REFINE === "undefined" &&
      typeof process.env.ENABLE_REFINE === "undefined") ||
    (process.env.NEXT_PUBLIC_ENABLE_REFINE ?? process.env.ENABLE_REFINE) !==
      "false";

  if (!isRefineEnabled) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Refine
        dataProvider={dataProvider}
        authProvider={authProvider}
        routerProvider={routerProvider}
        i18nProvider={i18nProvider}
        accessControlProvider={accessControlProvider}
        options={{
          syncWithLocation: true,
          warnWhenUnsavedChanges: true,
        }}
        resources={[
          {
            name: "apps",
            list: "/apps",
            create: "/apps/new",
            edit: "/apps/:id/edit",
            show: "/apps/:id",
            meta: { label: "Apps" },
          },
          {
            name: "subscriptions",
            list: "/subscriptions",
            create: "/subscriptions/new",
            edit: "/subscriptions/:id/edit",
            show: "/subscriptions/:id",
            meta: { label: "Subscriptions" },
          },
          {
            name: "users",
            list: "/users",
            show: "/users/:id",
            meta: { label: "Users" },
          },
          {
            name: "integrations",
            list: "/integrations",
            create: "/integrations/new",
            edit: "/integrations/:id/edit",
            show: "/integrations/:id",
            meta: { label: "Integrations" },
          },
          {
            name: "reports",
            list: "/reports",
            meta: { label: "Reports" },
          },
        ]}
      >
        {children}
      </Refine>
    </QueryClientProvider>
  );
}
