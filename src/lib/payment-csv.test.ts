// src/lib/payment-csv.test.ts
// Korean header names, Korean currency suffixes and the Korean bank statement header row below are
// functional test input: they match the columns/values of Korean card company, bank and ERP exports.
import { describe, expect, it } from "vitest";
import {
  detectCSVFormat,
  normalizePaymentData,
  parsePaymentAmount,
  parsePaymentCSV,
  parsePaymentDate,
} from "./payment-csv";

describe("payment-csv", () => {
  describe("parsePaymentAmount", () => {
    it("should parse amounts containing commas", () => {
      expect(parsePaymentAmount("1,000,000")).toBe(1000000);
      expect(parsePaymentAmount("100,000")).toBe(100000);
      expect(parsePaymentAmount("1,234,567")).toBe(1234567);
    });

    it("should parse amounts containing currency symbols", () => {
      expect(parsePaymentAmount("₩1,000,000")).toBe(1000000);
      expect(parsePaymentAmount("\\1,000,000")).toBe(1000000);
      expect(parsePaymentAmount("$100.00")).toBe(100);
      expect(parsePaymentAmount("USD 100.00")).toBe(100);
    });

    it("should parse amounts with the Korean won suffix", () => {
      expect(parsePaymentAmount("1,000,000원")).toBe(1000000);
      expect(parsePaymentAmount("50,000 원")).toBe(50000);
    });

    it("should parse plain numeric amounts", () => {
      expect(parsePaymentAmount("1000000")).toBe(1000000);
      expect(parsePaymentAmount("100")).toBe(100);
    });

    it("should return 0 for empty values", () => {
      expect(parsePaymentAmount("")).toBe(0);
      expect(parsePaymentAmount("   ")).toBe(0);
    });

    it("should parse negative amounts", () => {
      expect(parsePaymentAmount("-100,000")).toBe(-100000);
      expect(parsePaymentAmount("(100,000)")).toBe(-100000); // accounting notation
    });

    it("should parse decimal amounts", () => {
      expect(parsePaymentAmount("100.50")).toBe(100.5);
      expect(parsePaymentAmount("1,234.56")).toBe(1234.56);
    });
  });

  describe("parsePaymentDate", () => {
    it("should parse YYYY-MM-DD", () => {
      const result = parsePaymentDate("2024-01-15");
      expect(result?.toISOString().split("T")[0]).toBe("2024-01-15");
    });

    it("should parse YYYY/MM/DD", () => {
      const result = parsePaymentDate("2024/01/15");
      expect(result?.toISOString().split("T")[0]).toBe("2024-01-15");
    });

    it("should parse YYYYMMDD", () => {
      const result = parsePaymentDate("20240115");
      expect(result?.toISOString().split("T")[0]).toBe("2024-01-15");
    });

    it("should parse YY.MM.DD", () => {
      const result = parsePaymentDate("24.01.15");
      expect(result?.toISOString().split("T")[0]).toBe("2024-01-15");
    });

    it("should parse YYYY.MM.DD", () => {
      const result = parsePaymentDate("2024.01.15");
      expect(result?.toISOString().split("T")[0]).toBe("2024-01-15");
    });

    it("should return null for empty values", () => {
      expect(parsePaymentDate("")).toBeNull();
      expect(parsePaymentDate("   ")).toBeNull();
    });

    it("should return null for invalid dates", () => {
      expect(parsePaymentDate("invalid")).toBeNull();
      expect(parsePaymentDate("abc123")).toBeNull();
    });
  });

  describe("detectCSVFormat", () => {
    it("should detect the card company format", () => {
      const headers = [
        "결제일",
        "가맹점명",
        "결제금액",
        "카드번호",
        "승인번호",
      ];
      expect(detectCSVFormat(headers)).toBe("CARD_COMPANY");
    });

    it("should detect the ERP format (ECOUNT first when the account column is present)", () => {
      const headers = ["거래일자", "거래처명", "출금액", "계정과목", "비고"];
      // DA-83: ECOUNT header matching takes priority over generic ERP
      expect(detectCSVFormat(headers)).toBe("ERP_ECOUNT");
    });

    it("should detect the English card company format", () => {
      const headers = [
        "Transaction Date",
        "Merchant",
        "Amount",
        "Card Number",
        "Approval",
      ];
      expect(detectCSVFormat(headers)).toBe("CARD_COMPANY_EN");
    });

    it("should return UNKNOWN for an unknown format", () => {
      const headers = ["col1", "col2", "col3"];
      expect(detectCSVFormat(headers)).toBe("UNKNOWN");
    });

    it("should detect partially matching headers", () => {
      const headers = ["거래일자", "상호명", "결제금액"]; // the business-name header is an alias of the merchant-name header
      expect(detectCSVFormat(headers)).toBe("CARD_COMPANY");
    });
  });

  describe("normalizePaymentData", () => {
    it("should normalise card company CSV data", () => {
      const row = {
        결제일: "2024-01-15",
        가맹점명: "SLACK TECHNOLOGIES",
        결제금액: "100,000",
        카드번호: "1234-****-****-5678",
        승인번호: "12345678",
      };

      const result = normalizePaymentData(row, "CARD_COMPANY");

      expect(result).toEqual({
        transactionDate: expect.any(Date),
        merchantName: "SLACK TECHNOLOGIES",
        amount: 100000,
        cardLast4: "5678",
        approvalNumber: "12345678",
        rawData: row,
      });
    });

    it("should normalise ERP CSV data", () => {
      const row = {
        거래일자: "2024-01-15",
        거래처명: "Slack Technologies",
        출금액: "100,000",
        계정과목: "Software Expenses",
        비고: "January",
      };

      const result = normalizePaymentData(row, "ERP");

      expect(result).toEqual({
        transactionDate: expect.any(Date),
        merchantName: "Slack Technologies",
        amount: 100000,
        category: "Software Expenses",
        memo: "January",
        rawData: row,
      });
    });

    it("should normalise English card company data", () => {
      const row = {
        "Transaction Date": "2024-01-15",
        Merchant: "NOTION LABS INC",
        Amount: "$100.00",
        "Card Number": "**** 9876",
      };

      const result = normalizePaymentData(row, "CARD_COMPANY_EN");

      expect(result).toEqual({
        transactionDate: expect.any(Date),
        merchantName: "NOTION LABS INC",
        amount: 100,
        cardLast4: "9876",
        rawData: row,
      });
    });
  });

  describe("parsePaymentDate - datetime format", () => {
    it("should extract only the date part from YYYY-MM-DD HH:MM:SS", () => {
      const result = parsePaymentDate("2025-09-01 12:06:02");
      expect(result?.toISOString().split("T")[0]).toBe("2025-09-01");
    });

    it("should also handle YYYY-MM-DD HH:MM", () => {
      const result = parsePaymentDate("2025-12-25 09:30");
      expect(result?.toISOString().split("T")[0]).toBe("2025-12-25");
    });

    it("should parse plain YYYY-MM-DD unaffected", () => {
      const result = parsePaymentDate("2025-09-01");
      expect(result?.toISOString().split("T")[0]).toBe("2025-09-01");
    });
  });

  describe("parsePaymentCSV", () => {
    it("should parse a card company CSV", () => {
      const csv = `결제일,가맹점명,결제금액,카드번호,승인번호
2024-01-15,SLACK TECHNOLOGIES,100000,1234-****-****-5678,12345678
2024-01-16,NOTION LABS,50000,1234-****-****-5678,12345679`;

      const result = parsePaymentCSV(csv);

      expect(result.success).toBe(true);
      expect(result.format).toBe("CARD_COMPANY");
      expect(result.data).toHaveLength(2);
      expect(result.data![0].merchantName).toBe("SLACK TECHNOLOGIES");
      expect(result.data![0].amount).toBe(100000);
      expect(result.data![1].merchantName).toBe("NOTION LABS");
    });

    it("should parse an ERP CSV", () => {
      const csv = `거래일자,거래처명,출금액,계정과목,비고
2024-01-15,Slack,100000,Software Expenses,January
2024-01-16,Notion,50000,Software Expenses,January`;

      const result = parsePaymentCSV(csv);

      expect(result.success).toBe(true);
      // DA-83: the vendor name + account combination is detected as ECOUNT
      expect(result.format).toBe("ERP_ECOUNT");
      expect(result.data).toHaveLength(2);
    });

    it("should return an error for an empty CSV", () => {
      const result = parsePaymentCSV("");

      expect(result.success).toBe(false);
      expect(result.error).toBe("The CSV file is empty");
    });

    it("should return an error for a header-only CSV", () => {
      const result = parsePaymentCSV("결제일,가맹점명,결제금액");

      expect(result.success).toBe(false);
      expect(result.error).toBe("No data available");
    });

    it("should return an error for an unknown format", () => {
      const csv = `col1,col2,col3
val1,val2,val3`;

      const result = parsePaymentCSV(csv);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unsupported CSV format");
    });

    it("should collect validation errors", () => {
      const csv = `결제일,가맹점명,결제금액,카드번호,승인번호
invalid-date,SLACK,100000,1234,12345678
2024-01-16,,50000,5678,12345679`;

      const result = parsePaymentCSV(csv);

      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it("should correctly parse merchant names containing commas", () => {
      const csv = `결제일,가맹점명,결제금액,카드번호,승인번호
2024-01-15,"SLACK, INC.",100000,1234,12345678`;

      const result = parsePaymentCSV(csv);

      expect(result.success).toBe(true);
      expect(result.data![0].merchantName).toBe("SLACK, INC.");
    });

    it("should strip the UTF-8 BOM", () => {
      const csvWithBOM = `\uFEFF결제일,가맹점명,결제금액
2024-01-15,SLACK,100000`;

      const result = parsePaymentCSV(csvWithBOM);

      expect(result.success).toBe(true);
      expect(result.format).toBe("CARD_COMPANY");
    });

    it("should parse a bank statement CSV with summary rows at the top", () => {
      const bankCSV = `Print and save to file,,,,,,,,,,,,,,,,,,,,,
"Lump-sum total (KRW):20,562,437",,,,,,,,,,,,,,,,,,,,,
 ,승인구분,이용구분,승인일시,카드번호,카드별명,이용가맹점명,승인금액,현지외화금액,제휴카드명,할부개월,승인금액(USD),적용환율,이용수수료,승인번호,컵보증금,할인금액,취소금액,취소일자,매출표접수일자,결제예정일자,가맹점사업자번호
143,KRW,Domestic debit lump-sum,2025-09-01 12:06:02,4198-****-****-6969,Partner Card (Debit),IJO,"59,000",,Partner Card (Debit),Lump-sum,0,0,,70089704,0,0,0,,2025-09-02,2025-10-05,107-07-29331
142,KRW,Domestic debit lump-sum,2025-09-01 23:16:01,4198-****-****-6969,Partner Card (Debit),NHN KCP(,"71,000",,Partner Card (Debit),Lump-sum,0,0,,45915932,0,0,0,,2025-09-02,2025-10-05,113-85-21083`;

      const result = parsePaymentCSV(bankCSV);

      expect(result.success).toBe(true);
      expect(result.format).toBe("CARD_COMPANY");
      expect(result.data).toHaveLength(2);
      expect(result.data![0].merchantName).toBe("IJO");
      expect(result.data![0].amount).toBe(59000);
      expect(result.data![0].transactionDate.toISOString().split("T")[0]).toBe(
        "2025-09-01"
      );
      expect(result.data![1].merchantName).toBe("NHN KCP(");
    });

    it("should parse a regular CSV with the header on row 1 as before", () => {
      const normalCSV = `결제일,가맹점명,결제금액
2024-01-15,SLACK,100000`;

      const result = parsePaymentCSV(normalCSV);

      expect(result.success).toBe(true);
      expect(result.format).toBe("CARD_COMPANY");
      expect(result.data).toHaveLength(1);
    });

    it("should keep the existing behaviour when no header row is found", () => {
      const unknownCSV = `title row,,,
col1,col2,col3
val1,val2,val3`;

      const result = parsePaymentCSV(unknownCSV);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unsupported CSV format");
    });
  });
});
