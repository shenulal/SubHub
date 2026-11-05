// src/lib/erp-double-entry.test.ts
import { describe, expect, it } from "vitest";
import { convertDoubleEntry, type DoubleEntryRow } from "./erp-double-entry";
import type { DoubleEntryConfig } from "./erp-format-presets";

// Douzone iCUBE sample data (based on the Confluence plan)
const DUZON_SAMPLE: DoubleEntryRow[] = [
  {
    date: "20260401",
    amount: "150000",
    debitAccount: "81100",
    debitAccountName: "Employee Benefits",
    creditAccount: "25300",
    creditAccountName: "Accounts Payable",
    memo: "March Slack subscription",
    merchant: "Slack Technologies",
    rawData: {},
  },
  {
    date: "20260401",
    amount: "89000",
    debitAccount: "81200",
    debitAccountName: "Travel Expenses",
    creditAccount: "25300",
    creditAccountName: "Accounts Payable",
    memo: "March Notion team plan",
    merchant: "Notion Labs",
    rawData: {},
  },
  {
    date: "20260401",
    amount: "15000",
    debitAccount: "13500",
    debitAccountName: "Input VAT",
    creditAccount: "",
    creditAccountName: "VAT",
    memo: "VAT (Slack)",
    merchant: "",
    rawData: {},
  },
  {
    date: "20260402",
    amount: "450000",
    debitAccount: "81100",
    debitAccountName: "Employee Benefits",
    creditAccount: "25300",
    creditAccountName: "Accounts Payable",
    memo: "March GitHub Enterprise",
    merchant: "GitHub Inc",
    rawData: {},
  },
];

const DUZON_CONFIG: DoubleEntryConfig = {
  mode: "DEBIT_EXPENSE_ONLY",
  // Douzone iCUBE column names (mirrors the preset; Korean header names are functional)
  debitAccountField: "차변계정코드",
  creditAccountField: "대변계정코드",
  expenseAccountPrefixes: ["8"],
  vatAccountPrefixes: ["135"],
};

describe("erp-double-entry", () => {
  describe("DEBIT_EXPENSE_ONLY", () => {
    it("extracts only expense accounts (8xxx)", () => {
      const result = convertDoubleEntry(DUZON_SAMPLE, DUZON_CONFIG);
      // 81100 × 2 + 81200 × 1 = 3 entries (13500 input VAT excluded)
      expect(result.length).toBe(3);
      expect(
        result.every(
          (r) =>
            r.category?.startsWith("8") ||
            r.category?.startsWith("Employee") ||
            r.category?.startsWith("Travel")
        )
      ).toBe(true);
    });

    it("adds VAT (input VAT) to the expenses", () => {
      const result = convertDoubleEntry(DUZON_SAMPLE, DUZON_CONFIG);
      // 20260401: 2 expenses, VAT 15000 → 7500 allocated to each
      const apr1Items = result.filter((r) => r.date === "20260401");
      expect(apr1Items.length).toBe(2);

      const slackItem = apr1Items.find(
        (r) => r.memo === "March Slack subscription"
      );
      expect(slackItem).toBeDefined();
      expect(slackItem!.amount).toBe(150000 + 7500); // base expense + allocated VAT

      const notionItem = apr1Items.find(
        (r) => r.memo === "March Notion team plan"
      );
      expect(notionItem).toBeDefined();
      expect(notionItem!.amount).toBe(89000 + 7500);
    });

    it("does not add VAT to expenses on other dates", () => {
      const result = convertDoubleEntry(DUZON_SAMPLE, DUZON_CONFIG);
      const apr2Items = result.filter((r) => r.date === "20260402");
      expect(apr2Items.length).toBe(1);
      expect(apr2Items[0].amount).toBe(450000); // no VAT
    });
  });

  describe("DEBIT_ALL", () => {
    it("extracts all debits (excluding VAT rows)", () => {
      const config: DoubleEntryConfig = {
        mode: "DEBIT_ALL",
        expenseAccountPrefixes: [],
        vatAccountPrefixes: ["135"],
      };
      const result = convertDoubleEntry(DUZON_SAMPLE, config);
      expect(result.length).toBe(3); // 81100, 81200, 81100 (13500 VAT excluded)
    });
  });

  describe("NET_AMOUNT", () => {
    it("computes debit - credit net amount (returns positives only)", () => {
      const config: DoubleEntryConfig = {
        mode: "NET_AMOUNT",
        expenseAccountPrefixes: [],
        vatAccountPrefixes: [],
      };
      const result = convertDoubleEntry(DUZON_SAMPLE, config);
      // Grouped by date; only entries with netAmount > 0 are returned
      // 0401: debit(81100+81200+13500) - credit(25300+25300) net amount depends on the data
      // 0402: debit(81100) - credit(25300) > 0
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every((r) => r.amount > 0)).toBe(true);
    });
  });

  describe("NONE", () => {
    it("returns rows unchanged", () => {
      const config: DoubleEntryConfig = {
        mode: "NONE",
        expenseAccountPrefixes: [],
        vatAccountPrefixes: [],
      };
      const result = convertDoubleEntry(DUZON_SAMPLE, config);
      expect(result.length).toBe(4);
    });
  });
});
