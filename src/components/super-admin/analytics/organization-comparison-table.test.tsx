// src/components/super-admin/analytics/organization-comparison-table.test.tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrganizationComparisonTable } from "./organization-comparison-table";

const ROW = {
  id: "org-1",
  name: "Acme Trading",
  status: "suspended" as const,
  users: 12,
  activeUsers: 9,
  signedInUsers: 7,
  activeSubscriptions: 5,
  monthlySpend: 2020.01,
  pendingApprovals: 2,
  renewalsDue: 1,
  lastActivityAt: "2026-11-06T11:15:34.000Z",
};

describe("OrganizationComparisonTable", () => {
  it("links each organisation to its analytics and formats money in the base currency", () => {
    render(
      <OrganizationComparisonTable
        rows={[ROW]}
        currency="AED"
        period="90d"
        timeZone="Asia/Dubai"
      />
    );
    const link = screen.getByRole("link", { name: "Acme Trading" });
    expect(link.getAttribute("href")).toBe("/super-admin?org=org-1&period=90d");
    const row = link.closest("tr")!;
    expect(within(row).getByText("Suspended")).toBeTruthy();
    expect(within(row).getByText("AED 2,020.01")).toBeTruthy();
    expect(within(row).getByText("06 Nov 2026")).toBeTruthy();
  });

  it("shows an empty state without organisations", () => {
    render(
      <OrganizationComparisonTable
        rows={[]}
        currency="AED"
        period="90d"
        timeZone="Asia/Dubai"
      />
    );
    expect(screen.getByText("No organisations yet.")).toBeTruthy();
  });
});
