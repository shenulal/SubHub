// src/components/super-admin/analytics/analytics-toolbar.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
let search = "org=org-1";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/super-admin",
  useSearchParams: () => new URLSearchParams(search),
}));

import { AnalyticsToolbar } from "./analytics-toolbar";

const OPTIONS = [
  { token: "30d", label: "Last 30 days" },
  { token: "12m", label: "Last 12 months" },
];

beforeEach(() => {
  push.mockClear();
  search = "org=org-1";
});

describe("AnalyticsToolbar", () => {
  it("changes the period in the URL and keeps the selected organisation", async () => {
    render(
      <AnalyticsToolbar
        organizations={[{ id: "org-1", name: "Acme" }]}
        selectedOrganization="org-1"
        period="30d"
        periodOptions={OPTIONS}
      />
    );
    await userEvent.click(
      screen.getByRole("radio", { name: "Last 12 months" })
    );
    expect(push).toHaveBeenCalledWith("/super-admin?org=org-1&period=12m");
  });

  it("shows the organisation picker only when organisations are given", () => {
    const { rerender } = render(
      <AnalyticsToolbar period="30d" periodOptions={OPTIONS} />
    );
    expect(screen.queryByLabelText("Organisation")).toBeNull();
    rerender(
      <AnalyticsToolbar
        organizations={[{ id: "org-1", name: "Acme" }]}
        period="30d"
        periodOptions={OPTIONS}
      />
    );
    expect(screen.getByLabelText("Organisation")).toBeTruthy();
    expect(screen.getByText("All organisations")).toBeTruthy();
  });
});
