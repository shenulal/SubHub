// src/components/platform/masters/masters-tabs.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  MastersTabs,
  visibleMasterTabs,
  type MastersAccess,
  type MastersData,
} from "./masters-tabs";

// Panels are covered by their own tests; stub them to keep this test focused.
vi.mock("./currencies-panel", () => ({
  CurrenciesPanel: () => <div>currencies panel</div>,
}));
vi.mock("./countries-panel", () => ({ CountriesPanel: () => null }));
vi.mock("./tax-rates-panel", () => ({ TaxRatesPanel: () => null }));
vi.mock("./cost-centers-panel", () => ({ CostCentersPanel: () => null }));
vi.mock("./payment-methods-panel", () => ({ PaymentMethodsPanel: () => null }));
vi.mock("./billing-cycles-panel", () => ({ BillingCyclesPanel: () => null }));
vi.mock("./vendor-catalog-panel", () => ({ VendorCatalogPanel: () => null }));
vi.mock("./rejection-reasons-panel", () => ({
  RejectionReasonsPanel: () => null,
}));
vi.mock("@/components/taxonomy/category-tree-editor", () => ({
  CategoryTreeEditor: ({ canManage }: { canManage: boolean }) => (
    <div>category editor {canManage ? "manage" : "read"}</div>
  ),
}));
vi.mock("@/components/taxonomy/tag-manager", () => ({
  TagManager: () => null,
}));
vi.mock("@/components/taxonomy/custom-field-manager", () => ({
  CustomFieldManager: () => null,
}));

const NONE: MastersAccess = {
  readMasters: false,
  readCatalog: false,
  manageMasters: false,
  manageGlobal: false,
  readCategories: false,
  manageCategories: false,
  readTags: false,
  manageTags: false,
  createTags: false,
  readCustomFields: false,
  manageCustomFields: false,
  manageCatalog: false,
};

const DATA = {
  currencies: [],
  countries: [],
  catalog: { items: [], total: 0, page: 1, pageSize: 20, categories: [] },
} as unknown as MastersData;

describe("visibleMasterTabs", () => {
  it("shows every tab to a full reader", () => {
    expect(
      visibleMasterTabs({
        ...NONE,
        readMasters: true,
        readCatalog: true,
        readCategories: true,
        readTags: true,
        readCustomFields: true,
      })
    ).toEqual([
      "currencies",
      "countries",
      "tax-rates",
      "cost-centers",
      "payment-methods",
      "billing-cycles",
      "categories",
      "tags",
      "custom-fields",
      "rejection-reasons",
      "vendor-catalog",
    ]);
  });

  it("gates taxonomy tabs on their own read permissions", () => {
    expect(visibleMasterTabs({ ...NONE, readCategories: true })).toEqual([
      "categories",
    ]);
    expect(visibleMasterTabs({ ...NONE, readMasters: true })).not.toContain(
      "tags"
    );
  });

  it("gates the vendor catalog tab on catalog:read", () => {
    expect(visibleMasterTabs({ ...NONE, readMasters: true })).not.toContain(
      "vendor-catalog"
    );
    expect(visibleMasterTabs({ ...NONE, readCatalog: true })).toEqual([
      "vendor-catalog",
    ]);
  });
});

describe("MastersTabs", () => {
  it("renders the permitted tabs and the first one by default", () => {
    render(
      <MastersTabs
        data={DATA}
        access={{
          ...NONE,
          readMasters: true,
          readCatalog: true,
          readCategories: true,
        }}
      />
    );
    expect(screen.getByRole("tab", { name: /Currencies/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Countries/ })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Vendor catalog/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Categories/ })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /^Tags$/ })).toBeNull();
    expect(screen.getByText("currencies panel")).toBeInTheDocument();
  });

  it("falls back to the first permitted tab and passes manage flags", () => {
    render(
      <MastersTabs
        data={{ ...DATA, categoryTree: [] }}
        access={{ ...NONE, readCategories: true, manageCategories: true }}
      />
    );
    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getByText("category editor manage")).toBeInTheDocument();
  });

  it("renders nothing without any read permission", () => {
    const { container } = render(<MastersTabs data={DATA} access={NONE} />);
    expect(container).toBeEmptyDOMElement();
  });
});
