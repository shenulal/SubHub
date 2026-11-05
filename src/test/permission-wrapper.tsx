// src/test/permission-wrapper.tsx
/**
 * Renders UI inside a QueryClient whose `["me","permissions"]` cache is
 * pre-filled, so `usePermissions` / `usePermissionFlag` / `useSafePermissions`
 * answer synchronously without hitting `/api/v1/me/permissions`.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

export function renderWithPermissions(ui: ReactElement, permissions: string[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["me", "permissions"], new Set(permissions));
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}
