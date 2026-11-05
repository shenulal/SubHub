// src/lib/services/taxonomy/custom-field-options.test.ts
import { describe, expect, it } from "vitest";

import {
  formatCustomFieldValue,
  isOptionFieldType,
  parseMultiSelectValue,
  serializeMultiSelectValue,
} from "./custom-field-options";

describe("custom-field-options", () => {
  it("knows which field types carry options", () => {
    expect(isOptionFieldType("SELECT")).toBe(true);
    expect(isOptionFieldType("MULTI_SELECT")).toBe(true);
    expect(isOptionFieldType("TEXT")).toBe(false);
  });

  it("round-trips a multi-select value through JSON", () => {
    const stored = serializeMultiSelectValue(["AE", "SA", "AE"]);
    expect(stored).toBe('["AE","SA"]');
    expect(parseMultiSelectValue(stored)).toEqual(["AE", "SA"]);
  });

  it("stores an empty selection as an empty string", () => {
    expect(serializeMultiSelectValue([])).toBe("");
    expect(parseMultiSelectValue("")).toEqual([]);
  });

  it("reads a legacy plain value (e.g. a former SELECT) as one option", () => {
    expect(parseMultiSelectValue("Gold")).toEqual(["Gold"]);
    expect(parseMultiSelectValue("[not json")).toEqual(["[not json"]);
  });

  it("formats values for display", () => {
    expect(formatCustomFieldValue("MULTI_SELECT", '["AE","SA"]')).toBe(
      "AE, SA"
    );
    expect(formatCustomFieldValue("TEXT", "hello")).toBe("hello");
  });
});
