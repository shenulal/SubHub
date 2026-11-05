import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

// cmdk scrolls the active item into view; jsdom lacks the API.
Element.prototype.scrollIntoView = vi.fn();

function CurrencySelect({
  onChange,
  onCreate,
}: {
  onChange?: (v: string) => void;
  onCreate?: (q: string) => void;
}) {
  const [value, setValue] = useState("AED");
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    >
      <SelectTrigger aria-label="Currency">
        <SelectValue placeholder="Pick a currency" />
      </SelectTrigger>
      <SelectContent
        searchPlaceholder="Search currencies"
        createOption={
          onCreate ? { label: (q) => `Create "${q}"`, onCreate } : undefined
        }
      >
        <SelectItem value="AED">UAE Dirham</SelectItem>
        <SelectItem value="SAR">Saudi Riyal</SelectItem>
        <SelectItem value="USD">US Dollar</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe("searchable Select", () => {
  it("shows the selected item's label while closed", () => {
    render(<CurrencySelect />);
    expect(
      screen.getByRole("combobox", { name: "Currency" })
    ).toHaveTextContent("UAE Dirham");
  });

  it("shows the placeholder when nothing is selected", () => {
    render(
      <Select>
        <SelectTrigger aria-label="Empty">
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
        </SelectContent>
      </Select>
    );
    const trigger = screen.getByRole("combobox", { name: "Empty" });
    expect(trigger).toHaveTextContent("Pick one");
    expect(trigger).toHaveAttribute("data-placeholder");
  });

  it("filters options by the search text and selects one", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CurrencySelect onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Currency" }));
    const search = screen.getByPlaceholderText("Search currencies");
    await user.type(search, "riy");

    expect(
      screen.getByRole("option", { name: /Saudi Riyal/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /US Dollar/ })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /Saudi Riyal/ }));
    expect(onChange).toHaveBeenCalledWith("SAR");
    expect(
      screen.getByRole("combobox", { name: "Currency" })
    ).toHaveTextContent("Saudi Riyal");
  });

  it("matches on the option value as well as the label", async () => {
    const user = userEvent.setup();
    render(<CurrencySelect />);
    await user.click(screen.getByRole("combobox", { name: "Currency" }));
    await user.type(screen.getByPlaceholderText("Search currencies"), "usd");
    expect(
      screen.getByRole("option", { name: /US Dollar/ })
    ).toBeInTheDocument();
  });

  it("offers an inline create row that receives the search text", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<CurrencySelect onCreate={onCreate} />);
    await user.click(screen.getByRole("combobox", { name: "Currency" }));
    await user.type(
      screen.getByPlaceholderText("Search currencies"),
      "Omani Rial"
    );
    await user.click(
      screen.getByRole("option", { name: /Create "Omani Rial"/ })
    );
    expect(onCreate).toHaveBeenCalledWith("Omani Rial");
  });

  it("posts the value through a hidden input when a name is given", () => {
    const { container } = render(
      <Select name="currency" defaultValue="SAR">
        <SelectTrigger aria-label="Form currency">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="SAR">Saudi Riyal</SelectItem>
        </SelectContent>
      </Select>
    );
    const hidden = container.querySelector(
      'input[type="hidden"][name="currency"]'
    );
    expect(hidden).toHaveValue("SAR");
  });
});

const TEAMS = [
  { value: "eng", label: "Engineering" },
  { value: "fin", label: "Finance" },
  { value: "ops", label: "Operations" },
];

function TeamFilter({ onChange }: { onChange?: (v: string[]) => void }) {
  const [value, setValue] = useState<string[]>([]);
  return (
    <MultiSelect
      aria-label="Teams"
      options={TEAMS}
      value={value}
      onValueChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
      placeholder="All teams"
      searchPlaceholder="Search teams"
    />
  );
}

describe("MultiSelect", () => {
  it("toggles several options and shows them as chips", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TeamFilter onChange={onChange} />);
    const trigger = screen.getByRole("combobox", { name: "Teams" });
    expect(trigger).toHaveTextContent("All teams");

    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: /Finance/ }));
    await user.click(screen.getByRole("option", { name: /Engineering/ }));

    // Output keeps the option order, not the click order
    expect(onChange).toHaveBeenLastCalledWith(["eng", "fin"]);
    expect(trigger).toHaveTextContent("Engineering");
    expect(trigger).toHaveTextContent("Finance");
  });

  it("selects all and clears", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TeamFilter onChange={onChange} />);
    await user.click(screen.getByRole("combobox", { name: "Teams" }));
    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(onChange).toHaveBeenLastCalledWith(["eng", "fin", "ops"]);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("filters by search text", async () => {
    const user = userEvent.setup();
    render(<TeamFilter />);
    await user.click(screen.getByRole("combobox", { name: "Teams" }));
    await user.type(screen.getByPlaceholderText("Search teams"), "oper");
    expect(
      screen.getByRole("option", { name: /Operations/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Finance/ })
    ).not.toBeInTheDocument();
  });

  it("collapses extra selections into a +N chip", async () => {
    render(
      <MultiSelect
        aria-label="Many"
        options={TEAMS}
        value={["eng", "fin", "ops"]}
        onValueChange={() => {}}
        maxChips={1}
      />
    );
    expect(screen.getByRole("combobox", { name: "Many" })).toHaveTextContent(
      "+2"
    );
  });
});

describe("MultiSelect with an asynchronously applied value", () => {
  it("keeps earlier picks when the parent applies the value late (e.g. via the URL)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    // Parent that never re-renders with the new value (like a URL update still in flight)
    render(
      <MultiSelect
        aria-label="Lagging"
        options={TEAMS}
        value={[]}
        onValueChange={onChange}
      />
    );
    const trigger = screen.getByRole("combobox", { name: "Lagging" });
    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: /Engineering/ }));
    await user.click(screen.getByRole("option", { name: /Operations/ }));
    expect(onChange).toHaveBeenLastCalledWith(["eng", "ops"]);
    expect(trigger).toHaveTextContent("Engineering");
    expect(trigger).toHaveTextContent("Operations");
  });

  it("adopts an external value change such as a reset", () => {
    const { rerender } = render(
      <MultiSelect
        aria-label="Reset"
        options={TEAMS}
        value={["fin"]}
        onValueChange={() => {}}
      />
    );
    expect(screen.getByRole("combobox", { name: "Reset" })).toHaveTextContent(
      "Finance"
    );
    rerender(
      <MultiSelect
        aria-label="Reset"
        options={TEAMS}
        value={[]}
        onValueChange={() => {}}
        placeholder="All teams"
      />
    );
    expect(screen.getByRole("combobox", { name: "Reset" })).toHaveTextContent(
      "All teams"
    );
  });
});
