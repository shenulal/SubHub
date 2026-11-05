// src/components/approvals/service-name-autocomplete.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ServiceNameAutocomplete } from "./service-name-autocomplete";

vi.mock("@/actions/approvals/form-options", () => ({
  searchCatalog: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

function Harness({ onCreate }: { onCreate?: (q: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <ServiceNameAutocomplete
      id="svc"
      value={value}
      onChange={setValue}
      onSelect={vi.fn()}
      createOption={
        onCreate ? { label: (q) => `Create app “${q}”`, onCreate } : undefined
      }
    />
  );
}

describe("ServiceNameAutocomplete create row", () => {
  it("offers '+ Create app' for the typed name even without catalog matches", async () => {
    const onCreate = vi.fn();
    render(<Harness onCreate={onCreate} />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Acme" },
    });
    const row = await screen.findByText("Create app “Acme”");
    fireEvent.mouseDown(row);
    expect(onCreate).toHaveBeenCalledWith("Acme");
  });

  it("selects the create row with the keyboard", async () => {
    const onCreate = vi.fn();
    render(<Harness onCreate={onCreate} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Acme" } });
    await screen.findByText("Create app “Acme”");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCreate).toHaveBeenCalledWith("Acme");
  });

  it("stays closed without a create option when the catalog has no match", async () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Acme" },
    });
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
