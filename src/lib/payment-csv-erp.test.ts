// src/lib/payment-csv-erp.test.ts
// DA-83: detectCSVFormat ERP sub-format detection + regression tests for existing formats
// Korean header names and values below are functional test input: they match the columns of
// Korean card company and ERP exports that the parser must recognise.
import { describe, expect, it } from "vitest";
import {
  detectCSVFormat,
  isERPFormat,
  parsePaymentAmount,
  parsePaymentDate,
} from "./payment-csv";

describe("payment-csv - DA-83 ERP sub-formats", () => {
  describe("isERPFormat", () => {
    it("returns true for ERP formats", () => {
      expect(isERPFormat("ERP")).toBe(true);
      expect(isERPFormat("ERP_DUZON_ICUBE")).toBe(true);
      expect(isERPFormat("ERP_SAP_FI")).toBe(true);
      expect(isERPFormat("ERP_ORACLE_JOURNAL")).toBe(true);
      expect(isERPFormat("ERP_GENERIC")).toBe(true);
      expect(isERPFormat("CUSTOM")).toBe(true);
    });

    it("returns false for non-ERP formats", () => {
      expect(isERPFormat("CARD_COMPANY")).toBe(false);
      expect(isERPFormat("CARD_COMPANY_EN")).toBe(false);
      expect(isERPFormat("UNKNOWN")).toBe(false);
    });
  });

  describe("detectCSVFormat - existing format regression", () => {
    it("detects the Korean card company format", () => {
      const headers = [
        "결제일",
        "가맹점명",
        "결제금액",
        "카드번호",
        "승인번호",
      ];
      expect(detectCSVFormat(headers)).toBe("CARD_COMPANY");
    });

    it("detects the English card company format", () => {
      const headers = ["Transaction Date", "Merchant", "Amount", "Card Number"];
      expect(detectCSVFormat(headers)).toBe("CARD_COMPANY_EN");
    });

    it("detects generic ERP format (ECOUNT matches first when the account column is present)", () => {
      // The vendor name + account combination matches the ECOUNT detection rule
      const headers = ["거래일자", "거래처명", "출금액", "계정과목", "비고"];
      expect(detectCSVFormat(headers)).toBe("ERP_ECOUNT");
    });

    it("detects generic ERP format (ERP when there is no account column)", () => {
      const headers = ["거래일자", "거래처명", "출금액", "비고"];
      expect(detectCSVFormat(headers)).toBe("ERP");
    });
  });

  describe("detectCSVFormat - ERP vendor sub-formats", () => {
    it("detects Douzone iCUBE (with management number)", () => {
      const headers = [
        "전표일자",
        "차변계정코드",
        "대변계정코드",
        "적요",
        "금액",
        "거래처명",
        "관리번호",
      ];
      expect(detectCSVFormat(headers)).toBe("ERP_DUZON_ICUBE");
    });

    it("detects Douzone WEHAGO (without management number)", () => {
      const headers = [
        "전표일자",
        "차변계정코드",
        "대변계정코드",
        "적요",
        "금액",
      ];
      expect(detectCSVFormat(headers)).toBe("ERP_DUZON_WEHAGO");
    });

    it("detects SAP FI", () => {
      const headers = [
        "PostingDate",
        "GLAccount",
        "AmountInCompanyCodeCurrency",
        "SupplierName",
      ];
      expect(detectCSVFormat(headers)).toBe("ERP_SAP_FI");
    });

    it("detects Oracle Journal", () => {
      const headers = [
        "AccountingDate",
        "EnteredDebit",
        "EnteredCredit",
        "AccountClass",
      ];
      expect(detectCSVFormat(headers)).toBe("ERP_ORACLE_JOURNAL");
    });

    it("returns UNKNOWN for unrecognised formats", () => {
      const headers = ["col1", "col2", "col3"];
      expect(detectCSVFormat(headers)).toBe("UNKNOWN");
    });
  });

  describe("parsePaymentAmount - regression", () => {
    it("parses KRW amounts", () => {
      expect(parsePaymentAmount("150,000")).toBe(150000);
      expect(parsePaymentAmount("₩89,000")).toBe(89000);
    });

    it("parses USD amounts", () => {
      expect(parsePaymentAmount("$1,234.56")).toBe(1234.56);
    });

    it("parses accounting parentheses (negative)", () => {
      expect(parsePaymentAmount("(1,000)")).toBe(-1000);
    });

    it("returns 0 for empty values", () => {
      expect(parsePaymentAmount("")).toBe(0);
      expect(parsePaymentAmount("  ")).toBe(0);
    });
  });

  describe("parsePaymentDate - regression", () => {
    it("YYYY-MM-DD", () => {
      const d = parsePaymentDate("2026-04-01");
      expect(d).not.toBeNull();
      expect(d!.getUTCFullYear()).toBe(2026);
      expect(d!.getUTCMonth()).toBe(3);
    });

    it("YYYYMMDD", () => {
      const d = parsePaymentDate("20260401");
      expect(d).not.toBeNull();
      expect(d!.getUTCDate()).toBe(1);
    });

    it("parses Korean-format dates", () => {
      const d = parsePaymentDate("2026년 4월 1일");
      expect(d).not.toBeNull();
    });
  });
});
