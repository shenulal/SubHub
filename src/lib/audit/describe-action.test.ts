// src/lib/audit/describe-action.test.ts
import { describe, expect, it } from "vitest";

import { describeAuditAction } from "./describe-action";

describe("describeAuditAction", () => {
  it.each([
    ["CREATE_SAVED_VIEW", "Created a saved view"],
    ["APPROVAL_REQUEST_SUBMITTED", "Submitted an approval request"],
    [
      "APPROVAL_REQUEST_SUBSCRIPTION_CREATED",
      "Created a subscription from an approved request",
    ],
    ["ARCHIVE_SUBSCRIPTION", "Archived a subscription"],
    ["UPDATE_APPROVAL_POLICY", "Updated an approval policy"],
    ["REORDER_PAYMENT_METHODS", "Reordered payment methods"],
    ["EXPORT_SUBSCRIPTIONS", "Exported subscriptions"],
    ["UPDATE_SETTINGS", "Updated workspace settings"],
    ["CREATE_TAG", "Created a tag"],
    ["RESUME_SUBSCRIPTION", "Resumed a subscription"],
  ])("phrases %s", (code, sentence) => {
    expect(describeAuditAction(code)).toBe(sentence);
  });

  it("never returns a raw code for unknown actions", () => {
    expect(describeAuditAction("INVOICE_PAID")).toBe("Invoice paid");
    expect(describeAuditAction("SYNC_FX_RATES")).toBe("Synced FX rates");
  });

  it("returns an empty string for blank input", () => {
    expect(describeAuditAction("  ")).toBe("");
  });
});
