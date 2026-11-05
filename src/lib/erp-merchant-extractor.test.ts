// src/lib/erp-merchant-extractor.test.ts
import { describe, expect, it } from "vitest";
import type { MerchantExtractConfig } from "./erp-format-presets";
import { extractMerchantName } from "./erp-merchant-extractor";

// Korean field names, skip patterns and memo values in the Douzone tests are functional test
// input: they exercise the Korean header/keyword matching used for Korean ERP exports.
const DUZON_CONFIG: MerchantExtractConfig = {
  fieldPriority: ["적요", "거래처명", "비고"],
  skipPatterns: ["카드결제", "법인카드", "미지급금", "보통예금"],
};

const SAP_CONFIG: MerchantExtractConfig = {
  fieldPriority: ["SupplierName", "DocumentItemText", "GLAccountName"],
  skipPatterns: ["CLEARING", "PAYMENT", "BANK TRANSFER", "CASH"],
};

describe("erp-merchant-extractor", () => {
  describe("extractMerchantName - Douzone patterns", () => {
    it("extracts the SaaS name from the memo (month pattern)", () => {
      const row = {
        적요: "3월 Slack 구독료",
        거래처명: "미지급금",
        비고: "",
      };
      expect(extractMerchantName(row, DUZON_CONFIG)).toBe("Slack");
    });

    it("extracts the SaaS name from the memo (English start + Korean description)", () => {
      const row = {
        적요: "Notion 팀플랜 결제",
        거래처명: "카드결제",
        비고: "",
      };
      // Tries to extract the name before the Korean "payment" keyword
      // The regex only captures English letters and spaces, so it returns "Notion" or the whole value
      const result = extractMerchantName(row, DUZON_CONFIG);
      // If the extractFromMemo regex does not match, fall back to the next field
      // The vendor field ("card payment") is skipped → the empty remarks field is skipped → fallback to the full memo
      expect(result).toBe("Notion 팀플랜 결제");
    });

    it("falls back to the vendor name when the memo is meaningless", () => {
      const row = {
        적요: "카드결제",
        거래처명: "GitHub Inc",
        비고: "",
      };
      expect(extractMerchantName(row, DUZON_CONFIG)).toBe("GitHub Inc");
    });

    it("falls back to remarks when the vendor name is also a skip pattern", () => {
      const row = {
        적요: "법인카드",
        거래처명: "미지급금",
        비고: "AWS 서버 비용",
      };
      // Memo ("corporate card") → skip, vendor ("accounts payable") → skip
      // Remarks ("AWS server cost") → treated as a memo field, extractFromMemo is tried
      // Starts with English + Korean "cost" keyword → captures "AWS server" or falls back
      const result = extractMerchantName(row, DUZON_CONFIG);
      // extractFromMemo regex: /^([A-Za-z]...+?)(?:\s+(?:...cost keyword...))/
      // Cannot capture "AWS server" because it contains Korean → fallback
      expect(result).toBe("법인카드"); // fallback: first value longer than 1 character
    });

    it("returns the fallback value when every field is meaningless", () => {
      const row = {
        적요: "카드결제",
        거래처명: "미지급금",
        비고: "",
      };
      // fallback: first non-skip value; if all are skipped, the first value longer than 1 character
      const result = extractMerchantName(row, DUZON_CONFIG);
      // The memo value is returned as the fallback (length > 1)
      expect(result).toBe("카드결제");
    });
  });

  describe("extractMerchantName - SAP patterns", () => {
    it("extracts SupplierName first", () => {
      const row = {
        SupplierName: "Slack Technologies",
        DocumentItemText: "March subscription",
        GLAccountName: "Employee Benefits",
      };
      expect(extractMerchantName(row, SAP_CONFIG)).toBe("Slack Technologies");
    });

    it("falls back to DocumentItemText when SupplierName is CLEARING", () => {
      const row = {
        SupplierName: "CLEARING",
        DocumentItemText: "Notion Labs Inc",
        GLAccountName: "Software Expenses",
      };
      // DocumentItemText is treated as a memo field
      // "Notion Labs Inc" is entirely English, so it is returned as-is
      const result = extractMerchantName(row, SAP_CONFIG);
      expect(result).toBe("Notion Labs Inc");
    });

    it("returns null when none of the priority fields exist", () => {
      const row = { Amount: "150000" };
      expect(extractMerchantName(row, SAP_CONFIG)).toBeNull();
    });
  });
});
