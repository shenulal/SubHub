// src/lib/services/receipts/parser.test.ts
import { describe, expect, it } from "vitest";
import { htmlToText, parseReceipt } from "./parser";
import { extractAmount, parseLocalisedNumber } from "./parser.amount";
import {
  deriveNextRenewal,
  detectBillingCycle,
  parseDateToken,
} from "./parser.cycle";
import { RECEIPT_FIXTURES } from "./parser.fixtures";
import {
  cleanDisplayName,
  extractVendor,
  parseSender,
  registeredDomain,
} from "./parser.vendor";

const KNOWN = [
  {
    id: "cat-jira",
    name: "Jira",
    aliases: ["Jira Software", "Atlassian Jira"],
    website: "https://www.atlassian.com/software/jira",
  },
  {
    id: "cat-notion",
    name: "Notion",
    aliases: ["Notion Labs"],
    website: "https://www.notion.so",
  },
];

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

describe("parseReceipt fixtures", () => {
  it("covers at least 25 fixture emails", () => {
    expect(RECEIPT_FIXTURES.length).toBeGreaterThanOrEqual(25);
  });

  for (const fixture of RECEIPT_FIXTURES) {
    it(fixture.name, () => {
      const result = parseReceipt(fixture.message, { knownVendors: KNOWN });
      const e = fixture.expect;
      if (e.vendor !== undefined) expect(result.vendorName).toBe(e.vendor);
      if (e.amount !== undefined) expect(result.amount).toBe(e.amount);
      if (e.currency !== undefined) expect(result.currency).toBe(e.currency);
      if (e.cycle !== undefined) expect(result.billingCycle).toBe(e.cycle);
      if (e.trial !== undefined) expect(result.isTrial).toBe(e.trial);
      if (e.nextRenewal !== undefined)
        expect(iso(result.nextRenewalAt)).toBe(e.nextRenewal);
      if (e.chargedAt !== undefined)
        expect(iso(result.chargedAt)).toBe(e.chargedAt);
      if (e.minConfidence !== undefined)
        expect(result.confidence).toBeGreaterThanOrEqual(e.minConfidence);
      if (e.maxConfidence !== undefined)
        expect(result.confidence).toBeLessThan(e.maxConfidence);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  }

  it("derives next renewal from charge date when no explicit date exists", () => {
    const result = parseReceipt(RECEIPT_FIXTURES[5].message);
    expect(iso(result.nextRenewalAt)).toBe("2026-06-15");
    expect(result.signals.hasNextRenewal).toBe(false);
  });

  it("falls back to snippet when body and html are empty", () => {
    const result = parseReceipt({
      id: "x",
      from: "Acme <billing@acme.io>",
      subject: "Acme receipt",
      date: "2026-01-01T00:00:00Z",
      snippet: "Total $5.00 monthly",
      bodyText: "",
    });
    expect(result.amount).toBe(5);
    expect(result.billingCycle).toBe("MONTHLY");
  });

  it("returns null charge date for an unparseable message date", () => {
    const result = parseReceipt({
      id: "x",
      from: "Acme <billing@acme.io>",
      subject: "Acme receipt",
      date: "not-a-date",
      snippet: "",
      bodyText: "Total $5.00",
    });
    expect(result.chargedAt).toBeNull();
    expect(result.nextRenewalAt).toBeNull();
  });
});

describe("parseLocalisedNumber", () => {
  it.each([
    ["12.99", 12.99],
    ["9,99", 9.99],
    ["1,299.00", 1299],
    ["1.299,00", 1299],
    ["1 299,50", 1299.5],
    ["1,299", 1299],
    ["1.299", 1299],
    ["1,234,567.89", 1234567.89],
    ["45", 45],
  ])("parses %s → %d", (raw, expected) => {
    expect(parseLocalisedNumber(raw)).toBe(expected);
  });

  it("rejects garbage", () => {
    expect(parseLocalisedNumber("abc")).toBeNull();
  });
});

describe("extractAmount", () => {
  it("returns null when no money is present", () => {
    expect(extractAmount("hello world 2026")).toBeNull();
  });

  it("prefers the total line over larger line items", () => {
    const text = "Credit applied $500.00\nTotal $20.00";
    expect(extractAmount(text)).toEqual({ amount: 20, currency: "USD" });
  });

  it("uses the largest amount when there is no total line", () => {
    const text = "Seat A $4.00\nSeat B $4.00\nCombined charge $8.00";
    expect(extractAmount(text)?.amount).toBe(8);
  });

  it("maps bare $ to AUD when the text names AUD", () => {
    expect(extractAmount("Total $10.00 (AUD)")?.currency).toBe("AUD");
  });

  it("ignores zero amounts", () => {
    expect(extractAmount("Tax $0.00\nTotal $7.00")?.amount).toBe(7);
  });
});

describe("dates and cycles", () => {
  it.each([
    ["2026-01-05", "2026-01-05"],
    ["Jan 5, 2026", "2026-01-05"],
    ["5 January 2026", "2026-01-05"],
    ["01/05/2026", "2026-01-05"],
    ["05.01.2026", "2026-01-05"],
    ["25/01/2026", "2026-01-25"],
    ["March 3rd, 2026", "2026-03-03"],
  ])("parses %s", (raw, expected) => {
    expect(iso(parseDateToken(raw))).toBe(expected);
  });

  it("returns null for invalid calendar dates", () => {
    expect(parseDateToken("2026-13-45")).toBeNull();
    expect(parseDateToken("nothing here")).toBeNull();
  });

  it("picks the dominant cycle", () => {
    expect(detectBillingCycle("monthly monthly annual")).toBe("MONTHLY");
    expect(detectBillingCycle("billed annually")).toBe("YEARLY");
    expect(detectBillingCycle("every 3 months")).toBe("QUARTERLY");
    expect(detectBillingCycle("one-time payment")).toBe("ONE_TIME");
    expect(
      detectBillingCycle("one-time setup fee plus monthly plan")
    ).toBeNull();
    expect(detectBillingCycle("no cycle here")).toBeNull();
  });

  it("derives renewal by cycle", () => {
    const base = new Date("2026-01-31T00:00:00Z");
    expect(iso(deriveNextRenewal(base, "MONTHLY"))).toBe("2026-03-03");
    expect(iso(deriveNextRenewal(base, "YEARLY"))).toBe("2027-01-31");
    expect(deriveNextRenewal(base, "ONE_TIME")).toBeNull();
  });
});

describe("vendor helpers", () => {
  it("parses sender headers", () => {
    const s = parseSender('"Figma" <billing@figma.com>');
    expect(s).toMatchObject({
      displayName: "Figma",
      email: "billing@figma.com",
      domain: "figma.com",
    });
    expect(parseSender("bare@stripe.com").isProcessor).toBe(true);
    expect(parseSender("someone@gmail.com").isPublicMailbox).toBe(true);
    expect(parseSender("garbage").email).toBeNull();
  });

  it("computes registered domains", () => {
    expect(registeredDomain("mail.notifications.example.co.uk")).toBe(
      "example.co.uk"
    );
    expect(registeredDomain("billing.figma.com")).toBe("figma.com");
    expect(registeredDomain("figma.com")).toBe("figma.com");
  });

  it("cleans display names", () => {
    expect(cleanDisplayName("Notion Team")).toBe("Notion");
    expect(cleanDisplayName("HubSpot, Inc.")).toBe("HubSpot");
    expect(cleanDisplayName("Billing Team")).toBeNull();
    expect(cleanDisplayName("Acme via Stripe")).toBe("Acme");
  });

  it("uses catalog website domain to match a known vendor", () => {
    const v = extractVendor("Hello <hi@notion.so>", "Payment", KNOWN);
    expect(v.knownVendorId).toBe("cat-notion");
    expect(v.name).toBe("Notion");
  });

  it("falls back to domain label when sender is generic", () => {
    const v = extractVendor("billing@mail.acmeapp.com", "Hello", []);
    expect(v.name).toBe("Acmeapp");
  });

  it("returns null vendor for a processor with no subject hint", () => {
    const v = extractVendor("Stripe <receipts@stripe.com>", "Payment", []);
    expect(v.name).toBeNull();
    expect(v.domain).toBeNull();
  });
});

describe("htmlToText", () => {
  it("strips tags, scripts and entities", () => {
    const text = htmlToText(
      "<style>.a{}</style><script>x()</script><p>Total&nbsp;&amp; tax</p><table><tr><td>$5.00</td></tr></table>&#36;6"
    );
    expect(text).toContain("Total & tax");
    expect(text).toContain("$5.00");
    expect(text).toContain("$6");
    expect(text).not.toContain("<");
  });
});
