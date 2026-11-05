// src/components/platform/masters/countries-panel.test.tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CountryRow } from "@/types/platform";

vi.mock("@/actions/platform/masters/countries", () => ({
  createCountry: vi
    .fn()
    .mockResolvedValue({ success: true, data: { code: "OM" } }),
  updateCountry: vi.fn().mockResolvedValue({ success: true }),
  setCountryActive: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  createCountry,
  setCountryActive,
} from "@/actions/platform/masters/countries";

import { CountriesPanel } from "./countries-panel";

const rows: CountryRow[] = [
  {
    code: "AE",
    name: "United Arab Emirates",
    region: "GCC",
    currencyCode: "AED",
    defaultTaxRatePercent: 5,
    phonePrefix: "+971",
    isActive: true,
  },
  {
    code: "SA",
    name: "Saudi Arabia",
    region: "GCC",
    currencyCode: "SAR",
    defaultTaxRatePercent: 15,
    phonePrefix: "+966",
    isActive: false,
  },
];

describe("CountriesPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is read-only without masters:manage_global", () => {
    render(
      <CountriesPanel
        rows={rows}
        currencyCodes={["AED"]}
        canManageGlobal={false}
      />
    );
    expect(screen.getByText("United Arab Emirates")).toBeInTheDocument();
    expect(screen.getByText("15%")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add country/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Edit AE/ })).toBeNull();
  });

  it("filters by search text", () => {
    render(
      <CountriesPanel
        rows={rows}
        currencyCodes={["AED"]}
        canManageGlobal={false}
      />
    );
    fireEvent.change(screen.getByLabelText("Search countries"), {
      target: { value: "saudi" },
    });
    expect(screen.queryByText("United Arab Emirates")).toBeNull();
    expect(screen.getByText("Saudi Arabia")).toBeInTheDocument();
  });

  it("creates a country through the dialog", async () => {
    render(
      <CountriesPanel rows={rows} currencyCodes={["AED"]} canManageGlobal />
    );
    fireEvent.click(screen.getByRole("button", { name: /Add country/ }));
    fireEvent.change(screen.getByLabelText("Code"), {
      target: { value: "om" },
    });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Oman" },
    });
    fireEvent.change(screen.getByLabelText("Phone prefix"), {
      target: { value: "+968" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(createCountry).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "OM",
          name: "Oman",
          phonePrefix: "+968",
        })
      )
    );
  });

  it("activates an inactive country", async () => {
    render(
      <CountriesPanel rows={rows} currencyCodes={["AED"]} canManageGlobal />
    );
    fireEvent.click(screen.getByRole("button", { name: "Activate SA" }));
    await waitFor(() =>
      expect(setCountryActive).toHaveBeenCalledWith({
        code: "SA",
        isActive: true,
      })
    );
  });
});
