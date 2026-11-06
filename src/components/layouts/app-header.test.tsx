// src/components/layouts/app-header.test.tsx
import { SidebarProvider } from "@/components/ui/sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/auth", () => ({
  logout: vi.fn(),
}));

import messages from "@/i18n/messages/en.json";
import { AppHeader } from "./app-header";

// Mock useIsMobile
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

const renderWithProvider = (ui: React.ReactElement) => {
  // The header loads permissions and notification counts with React Query
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <SidebarProvider>{ui}</SidebarProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
};

describe("AppHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders the header", () => {
      renderWithProvider(<AppHeader />);
      expect(screen.getByTestId("app-header")).toBeInTheDocument();
    });

    it("has a sidebar toggle button", () => {
      renderWithProvider(<AppHeader />);
      // SidebarTrigger has the data-sidebar="trigger" attribute
      expect(screen.getByText(/toggle sidebar/i)).toBeInTheDocument();
    });
  });

  describe("search", () => {
    it("has a search button", () => {
      renderWithProvider(<AppHeader />);
      // CommandSearch renders as a button containing the "Search…" text
      expect(screen.getByText(/Search/i)).toBeInTheDocument();
    });
  });

  describe("notifications", () => {
    it("has a notifications button", () => {
      renderWithProvider(<AppHeader />);
      expect(screen.getByLabelText(/Notifications/i)).toBeInTheDocument();
    });
  });

  describe("user menu", () => {
    it("shows the user avatar", () => {
      renderWithProvider(<AppHeader />);
      expect(screen.getByTestId("user-menu-trigger")).toBeInTheDocument();
    });

    it("shows the dropdown when the user menu is clicked", async () => {
      const user = userEvent.setup();
      renderWithProvider(<AppHeader />);

      const userMenuTrigger = screen.getByTestId("user-menu-trigger");
      await user.click(userMenuTrigger);

      expect(screen.getByText("Profile")).toBeInTheDocument();
      expect(screen.getByText("Settings")).toBeInTheDocument();
      expect(screen.getByText("Log out")).toBeInTheDocument();
    });
  });
});
