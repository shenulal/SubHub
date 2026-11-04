import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CatalogItemDto } from "@/types/taxonomy";

let allowed = false;
vi.mock("../../hooks/use-permissions", () => ({
  usePermissions: () => ({
    can: () => allowed,
    isLoading: false,
    permissions: new Set(),
    refetch: vi.fn(),
  }),
}));
vi.mock("@/actions/taxonomy/catalog", () => ({
  updateCatalogItem: vi.fn(),
  setAppCancellationOverride: vi.fn(),
}));

import { CancellationGuide } from "./cancellation-guide";

const catalog: CatalogItemDto = {
  id: "c",
  name: "Slack",
  slug: "slack",
  category: "Software",
  subcategory: null,
  description: null,
  logoUrl: null,
  website: null,
  vendorName: null,
  pricingModel: null,
  basePricePerSeat: null,
  basePriceCurrency: null,
  aliases: [],
  cancellationUrl: "https://slack.com/cancel",
  billingPortalUrl: "https://slack.com/billing",
  cancellationSteps: ["Open settings", "Click cancel", "Confirm"],
  noticePeriodDays: 30,
  countryCode: null,
  isActive: true,
};

describe("CancellationGuide", () => {
  it("renders steps, notice hint and external deep links", () => {
    render(<CancellationGuide catalog={catalog} appOverride={null} />);
    expect(
      screen.getByRole("heading", { name: "How to cancel" })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(
      screen.getByText(/notice before the renewal date/)
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Open cancellation page/ });
    expect(link).toHaveAttribute("href", "https://slack.com/cancel");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("target", "_blank");
    expect(
      screen.getByRole("link", { name: /Billing portal/ })
    ).toHaveAttribute("href", "https://slack.com/billing");
    expect(
      screen.queryByRole("button", { name: /Edit guide/ })
    ).not.toBeInTheDocument();
  });
  it("prefers the workspace override and shows notes", () => {
    render(
      <CancellationGuide
        catalog={catalog}
        appOverride={{
          cancellationUrl: "https://corp.example/cancel",
          cancellationNotes: "Email IT first",
        }}
        noticePeriodDays={7}
      />
    );
    expect(
      screen.getByRole("link", { name: /Open cancellation page/ })
    ).toHaveAttribute("href", "https://corp.example/cancel");
    expect(screen.getByText("Email IT first")).toBeInTheDocument();
    expect(
      screen.getByText(/notice before the renewal date/)
    ).toBeInTheDocument();
    expect(
      screen.getByText("Customised for your workspace")
    ).toBeInTheDocument();
  });
  it("shows the empty state and gates the edit affordance on permission", () => {
    render(<CancellationGuide catalog={null} appOverride={null} />);
    expect(screen.getByText(/No cancellation guide/)).toBeInTheDocument();
    allowed = true;
    render(
      <CancellationGuide catalog={catalog} appOverride={null} appId="app-1" />
    );
    expect(
      screen.getByRole("button", { name: /Edit guide/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Edit workspace notes/ })
    ).toBeInTheDocument();
  });
});
