import { describe, expect, it } from "vitest";

import type { CustomFieldDefinitionDto } from "@/types/taxonomy";

import {
  CUSTOM_FIELD_TEXT_MAX_LENGTH,
  keyFromLabel,
  validateCustomFieldValues,
} from "./custom-field-validation";

const def = (
  over: Partial<CustomFieldDefinitionDto> & {
    id: string;
    fieldType: CustomFieldDefinitionDto["fieldType"];
  }
): CustomFieldDefinitionDto => ({
  key: over.id,
  label: over.id,
  options: null,
  isRequired: false,
  sortOrder: 0,
  ...over,
});

const defs = [
  def({ id: "text", fieldType: "TEXT", isRequired: true }),
  def({ id: "num", fieldType: "NUMBER" }),
  def({ id: "date", fieldType: "DATE" }),
  def({ id: "sel", fieldType: "SELECT", options: ["A", "B"] }),
  def({ id: "old", fieldType: "TEXT", isRequired: true, isArchived: true }),
];

describe("validateCustomFieldValues", () => {
  it("accepts a fully valid payload", () => {
    const result = validateCustomFieldValues(defs, {
      text: "hi",
      num: "12.5",
      date: "2026-02-28",
      sel: "A",
    });
    expect(result).toEqual({ ok: true, errors: {} });
  });
  it("flags required fields that are empty or whitespace", () => {
    expect(validateCustomFieldValues(defs, { text: "   " }).errors.text).toBe(
      "required"
    );
    expect(validateCustomFieldValues(defs, {}).errors.text).toBe("required");
  });
  it("ignores archived definitions even when required", () => {
    expect(
      validateCustomFieldValues(defs, { text: "x" }).errors.old
    ).toBeUndefined();
  });
  it("validates numbers", () => {
    expect(
      validateCustomFieldValues(defs, { text: "x", num: "abc" }).errors.num
    ).toBe("invalidNumber");
    expect(validateCustomFieldValues(defs, { text: "x", num: "-3" }).ok).toBe(
      true
    );
  });
  it("validates ISO dates including impossible days", () => {
    expect(
      validateCustomFieldValues(defs, { text: "x", date: "2026-02-30" }).errors
        .date
    ).toBe("invalidDate");
    expect(
      validateCustomFieldValues(defs, { text: "x", date: "28/02/2026" }).errors
        .date
    ).toBe("invalidDate");
  });
  it("validates select options", () => {
    expect(
      validateCustomFieldValues(defs, { text: "x", sel: "C" }).errors.sel
    ).toBe("invalidOption");
  });
  it("rejects unknown field ids and over-long text", () => {
    const result = validateCustomFieldValues(defs, {
      text: "a".repeat(CUSTOM_FIELD_TEXT_MAX_LENGTH + 1),
      ghost: "1",
    });
    expect(result.errors.text).toBe("tooLong");
    expect(result.errors.ghost).toBe("unknownField");
    expect(result.ok).toBe(false);
  });
});

describe("keyFromLabel", () => {
  it("derives snake_case keys", () => {
    expect(keyFromLabel("Contract Owner (email)")).toBe("contract_owner_email");
    expect(keyFromLabel("2024 budget")).toBe("f_2024_budget");
    expect(keyFromLabel("")).toBe("field");
  });
});

describe("MULTI_SELECT custom fields", () => {
  const multi = def({
    id: "regions",
    fieldType: "MULTI_SELECT",
    options: ["AE", "SA", "QA"],
  });

  it("accepts several listed options stored as a JSON array", () => {
    expect(
      validateCustomFieldValues([multi], { regions: '["AE","SA"]' }).ok
    ).toBe(true);
  });

  it("rejects an option outside the list", () => {
    expect(
      validateCustomFieldValues([multi], { regions: '["AE","XX"]' }).errors
        .regions
    ).toBe("invalidOption");
  });

  it("treats an empty selection as missing", () => {
    expect(validateCustomFieldValues([multi], { regions: "[]" }).ok).toBe(true);
    expect(
      validateCustomFieldValues([{ ...multi, isRequired: true }], {
        regions: "",
      }).errors.regions
    ).toBe("required");
  });
});
