// src/lib/services/export/csv.test.ts
import { describe, expect, it } from "vitest";
import {
  escapeCSVValue,
  formatCurrency,
  formatDate,
  generateCSV,
  type CSVColumn,
} from "./csv";

describe("CSV Export Service", () => {
  describe("escapeCSVValue", () => {
    it("returns plain strings unchanged", () => {
      expect(escapeCSVValue("hello")).toBe("hello");
    });

    it("wraps strings containing commas in quotes", () => {
      expect(escapeCSVValue("hello, world")).toBe('"hello, world"');
    });

    it("escapes strings containing quotes", () => {
      expect(escapeCSVValue('say "hello"')).toBe('"say ""hello"""');
    });

    it("wraps strings containing line breaks in quotes", () => {
      expect(escapeCSVValue("line1\nline2")).toBe('"line1\nline2"');
    });

    it("returns an empty string for null", () => {
      expect(escapeCSVValue(null)).toBe("");
    });

    it("returns an empty string for undefined", () => {
      expect(escapeCSVValue(undefined)).toBe("");
    });

    it("converts numbers to strings", () => {
      expect(escapeCSVValue(12345)).toBe("12345");
    });
  });

  describe("formatCurrency", () => {
    it("formats KRW with thousands separators", () => {
      expect(formatCurrency(1234567, "KRW")).toBe("₩1,234,567");
    });

    it("formats USD with 2 decimal places", () => {
      // The en-US locale shows USD as $
      expect(formatCurrency(1234.56, "USD")).toBe("$1,234.56");
    });

    it("shows 0 as ₩0", () => {
      expect(formatCurrency(0, "KRW")).toBe("₩0");
    });
  });

  describe("formatDate", () => {
    it("converts a Date to YYYY-MM-DD", () => {
      const date = new Date("2024-12-01T00:00:00Z");
      expect(formatDate(date)).toBe("2024-12-01");
    });

    it("returns an empty string for null", () => {
      expect(formatDate(null)).toBe("");
    });

    it("handles string dates", () => {
      expect(formatDate("2024-12-01")).toBe("2024-12-01");
    });
  });

  describe("generateCSV", () => {
    const columns: CSVColumn[] = [
      { key: "name", header: "Name" },
      { key: "email", header: "Email" },
      { key: "amount", header: "Amount" },
    ];

    const data = [
      { name: "Ahmed Ali", email: "hong@example.com", amount: 10000 },
      { name: "Fatima Hassan", email: "kim@example.com", amount: 20000 },
    ];

    it("includes the header row", () => {
      const csv = generateCSV(columns, data);
      const lines = csv.split("\n");
      expect(lines[0]).toBe("Name,Email,Amount");
    });

    it("includes the data rows", () => {
      const csv = generateCSV(columns, data);
      const lines = csv.split("\n");
      expect(lines[1]).toBe("Ahmed Ali,hong@example.com,10000");
      expect(lines[2]).toBe("Fatima Hassan,kim@example.com,20000");
    });

    it("returns only the header for empty data", () => {
      const csv = generateCSV(columns, []);
      expect(csv).toBe("Name,Email,Amount");
    });

    it("applies the formatter function", () => {
      const columnsWithFormatter: CSVColumn[] = [
        { key: "name", header: "Name" },
        {
          key: "amount",
          header: "Amount",
          formatter: (value) => formatCurrency(value as number, "KRW"),
        },
      ];

      const csv = generateCSV(columnsWithFormatter, data);
      const lines = csv.split("\n");
      expect(lines[1]).toContain("₩10,000");
    });

    it("escapes values containing special characters", () => {
      const specialData = [
        { name: "Ali, Ahmed", email: "test@test.com", amount: 0 },
      ];
      const csv = generateCSV(columns, specialData);
      const lines = csv.split("\n");
      expect(lines[1]).toContain('"Ali, Ahmed"');
    });

    it("can generate a UTF-8 CSV with a BOM", () => {
      const csv = generateCSV(columns, data, { includeBOM: true });
      expect(csv.charCodeAt(0)).toBe(0xfeff);
    });
  });
});
