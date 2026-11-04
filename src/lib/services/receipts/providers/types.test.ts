// src/lib/services/receipts/providers/types.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getProvider, providerIdFromParam } from "./index";
import {
  getGmailCredentials,
  getOutlookCredentials,
  getProviderAvailability,
  looksLikeReceiptCandidate,
  requireCredentials,
  toIsoDate,
} from "./types";

const KEYS = [
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "MS_GRAPH_CLIENT_ID",
  "MS_GRAPH_CLIENT_SECRET",
];
const saved: Record<string, string | undefined> = {};

describe("provider env + helpers", () => {
  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("falls back from GMAIL_* to GOOGLE_* credentials", () => {
    expect(getGmailCredentials()).toBeNull();
    process.env.GOOGLE_CLIENT_ID = "g";
    process.env.GOOGLE_CLIENT_SECRET = "s";
    expect(getGmailCredentials()).toEqual({ clientId: "g", clientSecret: "s" });
    process.env.GMAIL_CLIENT_ID = "dedicated";
    process.env.GMAIL_CLIENT_SECRET = "ds";
    expect(getGmailCredentials()).toEqual({
      clientId: "dedicated",
      clientSecret: "ds",
    });
  });

  it("reports availability per provider", () => {
    expect(getProviderAvailability()).toEqual({ gmail: false, outlook: false });
    process.env.MS_GRAPH_CLIENT_ID = "m";
    process.env.MS_GRAPH_CLIENT_SECRET = "s";
    expect(getOutlookCredentials()).not.toBeNull();
    expect(getProviderAvailability()).toEqual({ gmail: false, outlook: true });
    expect(() => requireCredentials("GMAIL")).toThrow(/not configured/);
    expect(requireCredentials("OUTLOOK").clientId).toBe("m");
  });

  it("prefilters receipt-like subjects", () => {
    expect(looksLikeReceiptCandidate("Your invoice", "")).toBe(true);
    expect(looksLikeReceiptCandidate("Hi", "your subscription renews")).toBe(
      true
    );
    expect(looksLikeReceiptCandidate("Lunch?", "see you at noon")).toBe(false);
    expect(looksLikeReceiptCandidate(null, undefined)).toBe(false);
  });

  it("normalises dates", () => {
    expect(toIsoDate(0)).toBe("1970-01-01T00:00:00.000Z");
    expect(toIsoDate("2026-01-05")).toBe("2026-01-05T00:00:00.000Z");
    expect(toIsoDate("garbage")).toBe("garbage");
    expect(toIsoDate(null)).toBe("");
  });

  it("resolves providers by id and param", () => {
    expect(getProvider("GMAIL").id).toBe("GMAIL");
    expect(getProvider("OUTLOOK").id).toBe("OUTLOOK");
    expect(providerIdFromParam("gmail")).toBe("GMAIL");
    expect(providerIdFromParam("Outlook")).toBe("OUTLOOK");
    expect(providerIdFromParam("yahoo")).toBeNull();
  });
});
