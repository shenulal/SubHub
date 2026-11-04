// src/components/receipts/receipts.utils.test.ts
import { describe, expect, it } from "vitest";
import {
  confidenceLevel,
  formatDate,
  formatMoney,
  formatRelative,
  hasPriceDrift,
  isOpenStatus,
  toDateInput,
  vendorInitials,
} from "./receipts.utils";

describe("receipts.utils", () => {
  it("buckets confidence", () => {
    expect(confidenceLevel(0.9)).toBe("high");
    expect(confidenceLevel(0.7)).toBe("medium");
    expect(confidenceLevel(0.2)).toBe("low");
  });

  it("formats money with currency codes and tolerates bad codes", () => {
    expect(formatMoney(12, "USD")).toMatch(/USD\s?12\.00/);
    expect(formatMoney(45, "AED")).toMatch(/AED\s?45\.00/);
    expect(formatMoney(null, "USD")).toBeNull();
    expect(formatMoney(3, null)).toBe("3.00");
    expect(formatMoney(3, "NOTACODE")).toBe("NOTACODE 3.00");
  });

  it("formats dates in UTC and rejects garbage", () => {
    expect(formatDate("2026-02-05T00:00:00.000Z")).toBe("Feb 5, 2026");
    expect(formatDate(null)).toBeNull();
    expect(formatDate("nope")).toBeNull();
    expect(toDateInput("2026-02-05T00:00:00.000Z")).toBe("2026-02-05");
    expect(toDateInput(null)).toBe("");
  });

  it("formats relative time", () => {
    const now = Date.UTC(2026, 0, 10, 12);
    expect(formatRelative(new Date(now - 5 * 60_000).toISOString(), now)).toBe(
      "5 minutes ago"
    );
    expect(
      formatRelative(new Date(now - 3 * 3_600_000).toISOString(), now)
    ).toBe("3 hours ago");
    expect(
      formatRelative(new Date(now - 2 * 86_400_000).toISOString(), now)
    ).toBe("2 days ago");
    expect(formatRelative(null, now)).toBeNull();
  });

  it("derives initials and open status", () => {
    expect(vendorInitials("Zoom Video")).toBe("ZV");
    expect(vendorInitials("notion")).toBe("N");
    expect(vendorInitials("  ")).toBe("?");
    expect(isOpenStatus("NEW")).toBe(true);
    expect(isOpenStatus("DISMISSED")).toBe(false);
  });

  it("detects price drift only for same-currency matches", () => {
    expect(hasPriceDrift(12, "USD", { amount: 10, currency: "usd" })).toBe(
      true
    );
    expect(hasPriceDrift(10, "USD", { amount: 10, currency: "USD" })).toBe(
      false
    );
    expect(hasPriceDrift(12, "AED", { amount: 10, currency: "USD" })).toBe(
      false
    );
    expect(hasPriceDrift(null, "USD", { amount: 10, currency: "USD" })).toBe(
      false
    );
    expect(hasPriceDrift(12, "USD", null)).toBe(false);
  });
});
