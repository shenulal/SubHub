// src/components/platform/masters/vendor-catalog-panel.test.tsx
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogPage } from "@/actions/taxonomy/catalog-admin";
import type { CatalogItemDto } from "@/types/taxonomy";

vi.mock("@/actions/taxonomy/catalog-admin", () => ({
  listCatalogEntries: vi.fn(),
  setCatalogEntryActive: vi.fn().mockResolvedValue({ success: true }),
  createCatalogEntry: vi.fn(),
  editCatalogEntry: vi.fn(),
}));
vi.mock("@/actions/platform/masters/currencies", () => ({
  createCurrency: vi.fn(),
  updateCurrency: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  listCatalogEntries,
  setCatalogEntryActive,
} from "@/actions/taxonomy/catalog-admin";

import { VendorCatalogPanel } from "./vendor-catalog-panel";

const entry = (over: Partial<CatalogItemDto>): CatalogItemDto => ({
  id: "z",
  name: "Zoho Books",
  slug: "zoho-books",
  category: "Software",
  subcategory: null,
  description: null,
  logoUrl: null,
  website: "https://zoho.com",
  vendorName: "Zoho",
  pricingModel: "PER_SEAT",
  basePricePerSeat: 15,
  basePriceCurrency: "AED",
  aliases: [],
  cancellationUrl: null,
  billingPortalUrl: null,
  cancellationSteps: [],
  noticePeriodDays: null,
  countryCode: "AE",
  isActive: true,
  ...over,
});

const page = (items: CatalogItemDto[], total = items.length): CatalogPage => ({
  items,
  total,
  page: 1,
  pageSize: 20,
  categories: ["Software"],
});

const props = {
  currencyCodes: ["AED", "USD"],
  countries: [{ id: "AE", label: "United Arab Emirates (AE)" }],
  canManageGlobal: false,
  searchDebounceMs: 10,
};

describe("VendorCatalogPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => vi.useRealTimers());

  it("lists entries with pricing and hides management without catalog:manage", () => {
    render(
      <VendorCatalogPanel
        {...props}
        initial={page([entry({})], 41)}
        canManage={false}
      />
    );
    expect(screen.getByText("Zoho Books")).toBeInTheDocument();
    expect(screen.getByText("Per seat")).toBeInTheDocument();
    expect(screen.getByText("15 AED")).toBeInTheDocument();
    expect(screen.getByText("1–20 of 41")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Add catalog entry/ })
    ).toBeNull();
  });

  it("searches server-side after the debounce", async () => {
    vi.mocked(listCatalogEntries).mockResolvedValue({
      success: true,
      data: page([entry({ id: "s", name: "Slack" })]),
    });
    render(
      <VendorCatalogPanel {...props} initial={page([entry({})])} canManage />
    );
    fireEvent.change(screen.getByLabelText(/Search name/), {
      target: { value: "sla" },
    });
    await act(async () => {
      vi.advanceTimersByTime(20);
    });
    await waitFor(() =>
      expect(listCatalogEntries).toHaveBeenCalledWith({
        query: "sla",
        status: "all",
        page: 1,
      })
    );
    expect(await screen.findByText("Slack")).toBeInTheDocument();
  });

  it("deactivates an entry and opens the create dialog for managers", async () => {
    vi.mocked(listCatalogEntries).mockResolvedValue({
      success: true,
      data: page([entry({ isActive: false })]),
    });
    render(
      <VendorCatalogPanel {...props} initial={page([entry({})])} canManage />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Deactivate Zoho Books" })
    );
    await waitFor(() =>
      expect(setCatalogEntryActive).toHaveBeenCalledWith("z", false)
    );
    fireEvent.click(screen.getByRole("button", { name: /Add catalog entry/ }));
    expect(
      await screen.findByRole("heading", { name: "New app catalog entry" })
    ).toBeInTheDocument();
  });
});
