// src/lib/erp-format-presets.test.ts
import { describe, expect, it } from "vitest";
import { detectPreset, getAllPresets, getPreset } from "./erp-format-presets";

describe("erp-format-presets", () => {
  describe("getPreset", () => {
    it("returns the Douzone iCUBE preset", () => {
      const preset = getPreset("ERP_DUZON_ICUBE");
      expect(preset).toBeDefined();
      expect(preset!.name).toBe("Douzone iCUBE");
      expect(preset!.doubleEntry.mode).toBe("DEBIT_EXPENSE_ONLY");
    });

    it("returns the SAP FI preset", () => {
      const preset = getPreset("ERP_SAP_FI");
      expect(preset).toBeDefined();
      expect(preset!.name).toBe("SAP S/4HANA FI");
      expect(preset!.doubleEntry.expenseAccountPrefixes).toContain("6");
    });

    it("returns the Oracle Journal preset", () => {
      const preset = getPreset("ERP_ORACLE_JOURNAL");
      expect(preset).toBeDefined();
      expect(preset!.doubleEntry.expenseAccountPrefixes).toContain("EXPENSE");
    });

    it("returns undefined for an unknown format", () => {
      expect(getPreset("CARD_COMPANY")).toBeUndefined();
      expect(getPreset("UNKNOWN")).toBeUndefined();
    });
  });

  describe("detectPreset", () => {
    it("detects Douzone iCUBE headers (with management number)", () => {
      // Korean header names are functional: they are the actual Douzone export columns
      const headers = [
        "전표일자",
        "차변계정코드",
        "차변계정명",
        "대변계정코드",
        "대변계정명",
        "적요",
        "금액",
        "거래처명",
        "관리번호",
      ];
      const preset = detectPreset(headers);
      expect(preset).toBeDefined();
      expect(preset!.format).toBe("ERP_DUZON_ICUBE");
    });

    it("detects Douzone WEHAGO headers (no management number → same as iCUBE required → matches iCUBE)", () => {
      // detectPreset matches iCUBE on required headers alone (distinctive headers only set priority)
      // detectCSVFormat() in payment-csv.ts distinguishes them by the management number column
      // (Korean header names below are functional Douzone export columns)
      const headers = [
        "전표일자",
        "차변계정코드",
        "대변계정코드",
        "적요",
        "금액",
        "거래처명",
      ];
      const preset = detectPreset(headers);
      expect(preset).toBeDefined();
      // detectPreset returns iCUBE via the required match (without a management number it matches in step 2)
      expect(preset!.format).toBe("ERP_DUZON_ICUBE");
    });

    it("detects SAP FI headers", () => {
      const headers = [
        "PostingDate",
        "GLAccount",
        "GLAccountName",
        "AmountInCompanyCodeCurrency",
        "SupplierName",
      ];
      const preset = detectPreset(headers);
      expect(preset).toBeDefined();
      expect(preset!.format).toBe("ERP_SAP_FI");
    });

    it("detects Oracle Journal headers", () => {
      const headers = [
        "AccountingDate",
        "EnteredDebit",
        "EnteredCredit",
        "AccountClass",
        "Description",
      ];
      const preset = detectPreset(headers);
      expect(preset).toBeDefined();
      expect(preset!.format).toBe("ERP_ORACLE_JOURNAL");
    });

    it("returns undefined for unmatched headers", () => {
      const headers = ["column1", "column2", "column3"];
      expect(detectPreset(headers)).toBeUndefined();
    });
  });

  describe("getAllPresets", () => {
    it("returns 6 presets", () => {
      const presets = getAllPresets();
      expect(presets.length).toBe(6);
    });
  });
});
