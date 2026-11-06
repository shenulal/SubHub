// src/components/layouts/app-sidebar.test.tsx
import { SidebarProvider } from "@/components/ui/sidebar";
import messages from "@/i18n/messages/en.json";
import {
  SYSTEM_ROLE_TEMPLATES,
  type SystemRoleKey,
} from "@/lib/rbac/permissions";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSidebar } from "./app-sidebar";

// Mock next-auth (prevent env.js import error)
vi.mock("next-auth", () => ({
  __esModule: true,
  default: () => ({}),
}));

// Mock @/actions/auth to prevent next-auth import chain
vi.mock("@/actions/auth", () => ({
  logout: vi.fn(),
}));

// Mock usePathname
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard"),
}));

// Mock useIsMobile
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

const renderWithProvider = (
  ui: React.ReactElement,
  role: SystemRoleKey = "ADMIN"
) => {
  const client = new QueryClient();
  client.setQueryData(
    ["me", "permissions"],
    new Set<string>(SYSTEM_ROLE_TEMPLATES[role].grants)
  );
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <SidebarProvider>{ui}</SidebarProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
};

describe("AppSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders the sidebar", () => {
      renderWithProvider(<AppSidebar />);
      // The shadcn/ui Sidebar is identified by data-slot="sidebar"
      expect(screen.getByTestId("app-sidebar")).toBeInTheDocument();
    });

    it("shows the brand name", () => {
      renderWithProvider(<AppSidebar />);
      expect(screen.getByRole("img", { name: "SubHub" })).toBeInTheDocument();
    });
  });

  describe("menu items", () => {
    it("shows the dashboard menu", () => {
      renderWithProvider(<AppSidebar />);
      // Dashboard can appear in both the group label and the menu item
      expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
    });

    it("shows the management group menus", () => {
      renderWithProvider(<AppSidebar />);
      expect(screen.getByText("Organization")).toBeInTheDocument();
      expect(screen.getByText("Subscriptions")).toBeInTheDocument();
      expect(screen.getByText("Payments")).toBeInTheDocument();
      expect(screen.getByText("Extensions")).toBeInTheDocument();
    });

    it("shows the reports menu in the dashboard group", () => {
      renderWithProvider(<AppSidebar />);
      expect(screen.getByText("Reports")).toBeInTheDocument();
    });

    it("shows the system group menus", () => {
      renderWithProvider(<AppSidebar />);
      expect(screen.getByText("Integrations")).toBeInTheDocument();
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });
  });

  describe("group labels", () => {
    it("shows the dashboard group label", () => {
      renderWithProvider(<AppSidebar />);
      // The "Dashboard" text can appear in both the group label and the menu item
      expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
    });

    it("shows the management group label", () => {
      renderWithProvider(<AppSidebar />);
      expect(screen.getByText("Management")).toBeInTheDocument();
    });

    it("shows the system group label", () => {
      renderWithProvider(<AppSidebar />);
      expect(screen.getByText("System")).toBeInTheDocument();
    });
  });

  describe("navigation links", () => {
    it("direct-link menu items have the correct href", () => {
      renderWithProvider(<AppSidebar />);

      // Direct links without submenus
      expect(
        screen.getByRole("link", { name: /Integrations/ })
      ).toHaveAttribute("href", "/integrations");
      expect(screen.getByRole("link", { name: /Settings/ })).toHaveAttribute(
        "href",
        "/settings"
      );
    });

    it("renders every menu item as a link", () => {
      renderWithProvider(<AppSidebar />);

      // Every menu renders as a single link without submenus
      expect(screen.getByRole("link", { name: /Reports/ })).toHaveAttribute(
        "href",
        "/reports/cost"
      );
      expect(
        screen.getByRole("link", { name: /Organization/ })
      ).toHaveAttribute("href", "/teams");
      expect(screen.getByRole("link", { name: /Payments/ })).toHaveAttribute(
        "href",
        "/payments"
      );
    });
  });

  describe("active state", () => {
    it("marks the integrations menu active on the integrations path", async () => {
      const { usePathname } = await import("next/navigation");
      vi.mocked(usePathname).mockReturnValue("/integrations");

      renderWithProvider(<AppSidebar />);

      // Test with the direct-link integrations menu
      const integrationsLink = screen.getByRole("link", {
        name: /Integrations/,
      });
      expect(integrationsLink).toHaveAttribute("data-active", "true");
    });

    it("marks the subscriptions menu active on the /apps path", async () => {
      const { usePathname } = await import("next/navigation");
      vi.mocked(usePathname).mockReturnValue("/apps");

      renderWithProvider(<AppSidebar />);

      const subscriptionsLink = screen.getByRole("link", {
        name: /Subscriptions/,
      });
      expect(subscriptionsLink).toHaveAttribute("data-active", "true");
    });

    it("marks the organization menu active on the /users path", async () => {
      const { usePathname } = await import("next/navigation");
      vi.mocked(usePathname).mockReturnValue("/users");

      renderWithProvider(<AppSidebar />);

      const orgLink = screen.getByRole("link", { name: /Organization/ });
      expect(orgLink).toHaveAttribute("data-active", "true");
    });
  });

  describe("permission gating", () => {
    it("shows a member approvals and subscriptions but not payments or extensions", () => {
      renderWithProvider(<AppSidebar />, "MEMBER");
      expect(screen.getByRole("link", { name: /Approvals/ })).toBeTruthy();
      expect(screen.getByRole("link", { name: /^Subscriptions/ })).toBeTruthy();
      expect(screen.queryByRole("link", { name: /Payments/ })).toBeNull();
      expect(screen.queryByRole("link", { name: /Extensions/ })).toBeNull();
    });

    it("shows an approver payments but not extensions", () => {
      renderWithProvider(<AppSidebar />, "APPROVER");
      expect(screen.getByRole("link", { name: /Payments/ })).toBeTruthy();
      expect(screen.getByRole("link", { name: /Approvals/ })).toBeTruthy();
      expect(screen.queryByRole("link", { name: /Extensions/ })).toBeNull();
    });

    it("keeps only ungated entries while permissions are unknown", () => {
      render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <SidebarProvider>
            <AppSidebar />
          </SidebarProvider>
        </NextIntlClientProvider>
      );
      expect(screen.getByRole("link", { name: /Settings/ })).toBeTruthy();
      expect(screen.queryByRole("link", { name: /Approvals/ })).toBeNull();
    });
  });

  describe("master data entry", () => {
    const renderWithPermissions = (permissions: string[]) => {
      const client = new QueryClient();
      client.setQueryData(["me", "permissions"], new Set(permissions));
      return render(
        <QueryClientProvider client={client}>
          <NextIntlClientProvider
            locale="en"
            messages={{
              ...messages,
              platform: { sidebar: { masters: { title: "Master data" } } },
            }}
          >
            <SidebarProvider>
              <AppSidebar role="MEMBER" />
            </SidebarProvider>
          </NextIntlClientProvider>
        </QueryClientProvider>
      );
    };

    it("links to the master data hub for users with a masters read permission", () => {
      renderWithPermissions(["tags:read"]);
      expect(
        screen.getByRole("link", { name: /master data/i })
      ).toHaveAttribute("href", "/settings/masters");
    });

    it("is hidden without any masters or taxonomy read permission", () => {
      renderWithPermissions(["subscriptions:read"]);
      expect(
        screen.queryByRole("link", { name: /master data/i })
      ).not.toBeInTheDocument();
    });
  });
});
