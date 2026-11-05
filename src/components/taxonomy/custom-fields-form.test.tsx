import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CustomFieldDefinitionDto } from "@/types/taxonomy";

vi.mock("@/actions/taxonomy/custom-fields", () => ({
  getCustomFieldDefinitions: vi.fn().mockResolvedValue([]),
}));

import { CustomFieldsFields } from "./custom-fields-form";

const defs: CustomFieldDefinitionDto[] = [
  {
    id: "owner",
    key: "owner",
    label: "Contract owner",
    fieldType: "TEXT",
    options: null,
    isRequired: true,
    sortOrder: 0,
  },
  {
    id: "seats",
    key: "seats",
    label: "Seats",
    fieldType: "NUMBER",
    options: null,
    isRequired: false,
    sortOrder: 1,
  },
  {
    id: "start",
    key: "start",
    label: "Start",
    fieldType: "DATE",
    options: null,
    isRequired: false,
    sortOrder: 2,
  },
  {
    id: "tier",
    key: "tier",
    label: "Tier",
    fieldType: "SELECT",
    options: ["Gold", "Silver"],
    isRequired: false,
    sortOrder: 3,
  },
  {
    id: "old",
    key: "old",
    label: "Old",
    fieldType: "TEXT",
    options: null,
    isRequired: false,
    sortOrder: 4,
    isArchived: true,
  },
];

describe("CustomFieldsFields", () => {
  it("renders one control per active definition with the right input types", () => {
    render(
      <CustomFieldsFields values={{}} onChange={() => {}} definitions={defs} />
    );
    expect(screen.getByLabelText(/Contract owner/)).toHaveAttribute(
      "type",
      "text"
    );
    expect(screen.getByLabelText("Seats")).toHaveAttribute("type", "number");
    expect(screen.getByLabelText("Start")).toHaveAttribute("type", "date");
    expect(screen.getByRole("combobox", { name: "Tier" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Old")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Required")).toBeInTheDocument();
  });
  it("emits immutable value maps and shows validation after blur", () => {
    const onChange = vi.fn();
    const values = { seats: "3" };
    render(
      <CustomFieldsFields
        values={values}
        onChange={onChange}
        definitions={defs}
      />
    );
    fireEvent.change(screen.getByLabelText(/Contract owner/), {
      target: { value: "Ana" },
    });
    expect(onChange).toHaveBeenCalledWith({ seats: "3", owner: "Ana" });
    expect(values).toEqual({ seats: "3" });
    fireEvent.blur(screen.getByLabelText(/Contract owner/));
    expect(screen.getByText("This field is required")).toBeInTheDocument();
  });
  it("prefers server errors and renders nothing without definitions", () => {
    const { container, rerender } = render(
      <CustomFieldsFields
        values={{ seats: "x" }}
        onChange={() => {}}
        definitions={defs}
        errors={{ seats: "invalidNumber" }}
      />
    );
    expect(screen.getByText("Enter a valid number")).toBeInTheDocument();
    rerender(
      <CustomFieldsFields values={{}} onChange={() => {}} definitions={[]} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a multi-select custom field and stores picks as a JSON array", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const user = userEvent.setup();
    const onChange = vi.fn();
    const regions: CustomFieldDefinitionDto = {
      id: "regions",
      key: "regions",
      label: "Regions",
      fieldType: "MULTI_SELECT",
      options: ["AE", "SA", "QA"],
      isRequired: false,
      sortOrder: 0,
    };
    render(
      <CustomFieldsFields
        values={{ regions: '["AE"]' }}
        onChange={onChange}
        definitions={[regions]}
      />
    );
    const trigger = screen.getByRole("combobox", { name: "Regions" });
    expect(trigger).toHaveTextContent("AE");
    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: /SA/ }));
    expect(onChange).toHaveBeenLastCalledWith({ regions: '["AE","SA"]' });
  });
});
