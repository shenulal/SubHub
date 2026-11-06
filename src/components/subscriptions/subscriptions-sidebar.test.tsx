// src/components/subscriptions/subscriptions-sidebar.test.tsx
import { getAllMessages } from "@/i18n/messages";
import {
  SYSTEM_ROLE_TEMPLATES,
  type SystemRoleKey,
} from "@/lib/rbac/permissions";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { SubscriptionsSidebar } from "./subscriptions-sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/subscriptions",
  useSearchParams: () => new URLSearchParams(),
}));

function renderAs(role: SystemRoleKey) {
  const client = new QueryClient();
  client.setQueryData(
    ["me", "permissions"],
    new Set<string>(SYSTEM_ROLE_TEMPLATES[role].grants)
  );
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider
        locale="en"
        messages={getAllMessages("en") as unknown as AbstractIntlMessages}
      >
        <SubscriptionsSidebar />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

const hrefs = () =>
  screen.getAllByRole("link").map((a) => a.getAttribute("href") ?? "");

describe("SubscriptionsSidebar permission gating", () => {
  it("shows suggestions and receipts to an administrator", () => {
    renderAs("ADMIN");
    expect(hrefs()).toContain("/subscriptions/suggestions");
    expect(hrefs()).toContain("/subscriptions/receipts");
  });

  it("hides suggestions from a member but keeps receipts", () => {
    renderAs("MEMBER");
    expect(hrefs()).not.toContain("/subscriptions/suggestions");
    expect(hrefs()).toContain("/subscriptions/receipts");
  });

  it("hides both from a viewer", () => {
    renderAs("VIEWER");
    expect(hrefs()).not.toContain("/subscriptions/suggestions");
    expect(hrefs()).not.toContain("/subscriptions/receipts");
    expect(hrefs()).toContain("/subscriptions");
  });
});
