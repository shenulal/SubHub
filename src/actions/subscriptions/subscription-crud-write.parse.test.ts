import { DEFAULT_BASE_CURRENCY } from "@/lib/fx/convert";
import { describe, expect, it } from "vitest";
import {
  blankToNull,
  parseCustomFields,
  parseSubscriptionFormData,
  toDateOrNull,
} from "./subscription-crud-write.parse";

function form(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

describe("parseSubscriptionFormData", () => {
  it("reads scalars, booleans and repeated/CSV lists", () => {
    const parsed = parseSubscriptionFormData(
      form([
        ["appName", "Slack"],
        ["amount", "12.5"],
        ["autoRenewal", "on"],
        ["isTrial", "true"],
        ["isPersonal", "false"],
        ["reminderLeadDays", "7,3"],
        ["reminderLeadDays", "1"],
        ["tagNames", "core"],
        ["tagNames", "eng"],
        ["teamIds", "t1"],
        ["noticePeriodDays", ""],
      ])
    );
    expect(parsed).toMatchObject({
      appName: "Slack",
      appId: null,
      amount: "12.5",
      autoRenewal: true,
      isTrial: true,
      isPersonal: false,
      reminderLeadDays: ["7", "3", "1"],
      tagNames: ["core", "eng"],
      teamIds: ["t1"],
      noticePeriodDays: null,
      billingType: "FLAT_RATE",
      currency: DEFAULT_BASE_CURRENCY,
    });
  });

  it("leaves reminderLeadDays undefined when absent and applies defaults", () => {
    const parsed = parseSubscriptionFormData(form([]), {
      billingType: "PER_SEAT",
      currency: "AED",
      status: "PAUSED",
    });
    expect(parsed.reminderLeadDays).toBeUndefined();
    expect(parsed.billingType).toBe("PER_SEAT");
    expect(parsed.currency).toBe("AED");
    expect(parsed.status).toBe("PAUSED");
    expect(parsed.autoRenewal).toBe(false);
  });
});

describe("parseCustomFields", () => {
  it("accepts a JSON object and bracket entries", () => {
    const fd = form([
      ["customFields", JSON.stringify({ cf_1: "PO-7", cf_2: 42 })],
      ["customFields[cf_3]", "x"],
    ]);
    expect(parseCustomFields(fd)).toEqual({
      cf_1: "PO-7",
      cf_2: "42",
      cf_3: "x",
    });
  });

  it("ignores malformed JSON", () => {
    expect(parseCustomFields(form([["customFields", "{nope"]]))).toEqual({});
  });
});

describe("blankToNull / toDateOrNull", () => {
  it("normalises blanks and invalid dates", () => {
    expect(blankToNull("")).toBeNull();
    expect(blankToNull("x")).toBe("x");
    expect(toDateOrNull("")).toBeNull();
    expect(toDateOrNull("nope")).toBeNull();
    expect(toDateOrNull("2026-01-02")?.toISOString()).toBe(
      "2026-01-02T00:00:00.000Z"
    );
  });
});
