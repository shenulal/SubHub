import { describe, expect, it } from "vitest";
import {
  buildStorageKey,
  isKeyInOrganization,
  safeFileName,
  validateAttachment,
} from "./attachments";

const policy = {
  maxSizeMb: 2,
  allowedMimeTypes: ["application/pdf", "image/png"],
};

describe("validateAttachment", () => {
  it("accepts a file within size and mime policy", () => {
    expect(
      validateAttachment(
        { sizeBytes: 1024, mimeType: "application/pdf", fileName: "a.pdf" },
        policy
      )
    ).toEqual({ ok: true });
  });

  it("rejects empty, oversized and disallowed files", () => {
    expect(
      validateAttachment(
        { sizeBytes: 0, mimeType: "application/pdf", fileName: "a.pdf" },
        policy
      ).error
    ).toBe("empty");
    expect(
      validateAttachment(
        {
          sizeBytes: 3 * 1024 * 1024,
          mimeType: "application/pdf",
          fileName: "a",
        },
        policy
      ).error
    ).toBe("too_large");
    expect(
      validateAttachment(
        {
          sizeBytes: 10,
          mimeType: "application/x-msdownload",
          fileName: "a.exe",
        },
        policy
      ).error
    ).toBe("mime_not_allowed");
  });

  it("normalises mime parameters and case", () => {
    expect(
      validateAttachment(
        {
          sizeBytes: 10,
          mimeType: "Image/PNG; charset=binary",
          fileName: "x.png",
        },
        policy
      ).ok
    ).toBe(true);
  });
});

describe("safeFileName / buildStorageKey", () => {
  it("strips directories and unsafe characters", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("Contract (final) v2.pdf")).toBe(
      "Contract_final_v2.pdf"
    );
    expect(safeFileName("")).toBe("file");
  });

  it("builds the organisation-scoped key", () => {
    expect(buildStorageKey("org-1", "sub-1", "Q1 invoice.pdf", "abc")).toBe(
      "org/org-1/subscriptions/sub-1/abc-Q1_invoice.pdf"
    );
    expect(buildStorageKey("org-1", "sub-1", "x.pdf")).toMatch(
      /^org\/org-1\/subscriptions\/sub-1\/[0-9a-f-]{36}-x\.pdf$/
    );
  });

  it("detects keys outside the organisation prefix", () => {
    expect(isKeyInOrganization("org/org-1/subscriptions/s/x", "org-1")).toBe(
      true
    );
    expect(isKeyInOrganization("org/org-2/subscriptions/s/x", "org-1")).toBe(
      false
    );
    expect(isKeyInOrganization("org/org-1/../org-2/x", "org-1")).toBe(false);
  });
});
