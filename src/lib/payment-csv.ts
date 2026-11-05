// src/lib/payment-csv.ts
//
// NOTE: the Korean header aliases, currency suffixes and date pattern in this file are functional.
// They must match the column headers and values in Korean card company / bank / ERP exports
// verbatim, so they must not be translated.

import { parseCSV } from "./csv";

// CSV format type
export type PaymentCSVFormat =
  | "CARD_COMPANY"
  | "CARD_COMPANY_EN"
  | "ERP"
  | "ERP_DUZON_ICUBE"
  | "ERP_DUZON_WEHAGO"
  | "ERP_SAP_FI"
  | "ERP_ORACLE_JOURNAL"
  | "ERP_ECOUNT"
  | "ERP_GENERIC"
  | "CUSTOM"
  | "UNKNOWN";

// Helper that checks whether a format is an ERP sub-format
export function isERPFormat(format: PaymentCSVFormat): boolean {
  return format === "ERP" || format.startsWith("ERP_") || format === "CUSTOM";
}

// Parsed payment data row
export interface PaymentCSVRow {
  transactionDate: Date;
  merchantName: string;
  amount: number;
  cardLast4?: string;
  approvalNumber?: string;
  category?: string;
  memo?: string;
  rawData: Record<string, string>;
}

// Validation error
export interface PaymentValidationError {
  row: number;
  field: string;
  message: string;
}

// Parse result
export interface PaymentCSVParseResult {
  success: boolean;
  format?: PaymentCSVFormat;
  data?: PaymentCSVRow[];
  errors?: PaymentValidationError[];
  error?: string;
}

// Card company CSV header mapping (Korean headers)
const CARD_COMPANY_HEADERS = {
  date: ["결제일", "거래일", "이용일", "사용일", "승인일"],
  merchant: ["가맹점명", "상호명", "가맹점", "이용가맹점", "사용처"],
  amount: ["결제금액", "이용금액", "사용금액", "금액", "결제액", "승인금액"],
  cardNumber: ["카드번호"],
  approval: ["승인번호", "승인 번호"],
};

// ERP CSV header mapping (original generic)
const ERP_HEADERS = {
  date: ["거래일자", "일자", "전표일자"],
  merchant: ["거래처명", "거래처", "상대계정"],
  amount: ["출금액", "지출액", "금액", "차변"],
  category: ["계정과목", "계정", "과목"],
  memo: ["비고", "적요", "메모"],
};

// Douzone iCUBE header mapping
const ERP_DUZON_ICUBE_HEADERS = {
  date: ["전표일자"],
  debitAccount: ["차변계정코드"],
  debitAccountName: ["차변계정명"],
  creditAccount: ["대변계정코드"],
  creditAccountName: ["대변계정명"],
  memo: ["적요"],
  amount: ["금액"],
  merchantCode: ["거래처코드"],
  merchant: ["거래처명"],
  managementNumber: ["관리번호"],
};

// Douzone WEHAGO header mapping
const ERP_DUZON_WEHAGO_HEADERS = {
  date: ["전표일자", "일자"],
  debitAccount: ["차변계정코드", "차변코드"],
  debitAccountName: ["차변계정명", "차변과목"],
  creditAccount: ["대변계정코드", "대변코드"],
  creditAccountName: ["대변계정명", "대변과목"],
  memo: ["적요"],
  amount: ["금액"],
  merchant: ["거래처명", "거래처"],
};

// SAP S/4HANA FI header mapping
const ERP_SAP_FI_HEADERS = {
  date: ["PostingDate", "DocumentDate"],
  glAccount: ["GLAccount"],
  glAccountName: ["GLAccountName"],
  amount: ["AmountInCompanyCodeCurrency", "Amount"],
  currency: ["CompanyCodeCurrency", "Currency"],
  documentText: ["DocumentItemText"],
  supplier: ["SupplierName", "Supplier"],
  companyCode: ["CompanyCode"],
  document: ["AccountingDocument"],
};

// Oracle ERP Cloud Journal header mapping
const ERP_ORACLE_JOURNAL_HEADERS = {
  date: ["AccountingDate", "JournalDate"],
  debitAmount: ["EnteredDebit", "DebitAmount"],
  creditAmount: ["EnteredCredit", "CreditAmount"],
  accountClass: ["AccountClass", "AccountType"],
  description: ["Description", "LineDescription"],
  currency: ["Currency", "EnteredCurrency"],
  journalName: ["JournalName"],
};

// ECOUNT header mapping
const ERP_ECOUNT_HEADERS = {
  date: ["일자", "날짜"],
  merchant: ["거래처", "거래처명"],
  amount: ["금액", "출금"],
  category: ["계정과목"],
  memo: ["적요", "비고"],
};

// English card company CSV header mapping
const CARD_COMPANY_EN_HEADERS = {
  date: ["Transaction Date", "Date", "Trans Date", "Posted Date"],
  merchant: ["Merchant", "Description", "Merchant Name", "Vendor"],
  amount: ["Amount", "Transaction Amount", "Charge Amount"],
  cardNumber: ["Card Number", "Card No", "Card"],
  approval: ["Approval", "Authorization", "Approval Code"],
};

/**
 * Parse an amount string into a number
 */
export function parsePaymentAmount(amountStr: string): number {
  if (!amountStr || !amountStr.trim()) {
    return 0;
  }

  let cleaned = amountStr.trim();

  // Accounting notation (parentheses mean negative)
  const isNegativeParens = /^\(.*\)$/.test(cleaned);
  if (isNegativeParens) {
    cleaned = cleaned.replace(/[()]/g, "");
  }

  // Strip currency symbols and codes.
  // The last pattern strips Korean currency suffixes (won/dollar/yen) found in Korean
  // card statements; those Korean literals are functional and must stay as-is.
  cleaned = cleaned.replace(/[₩\\$€£¥]/g, "");
  cleaned = cleaned.replace(/^(USD|KRW|EUR|JPY|GBP)\s*/i, "");
  cleaned = cleaned.replace(/\s*(원|달러|엔)$/g, "");

  // Remove thousands separators
  cleaned = cleaned.replace(/,/g, "");

  // Trim whitespace
  cleaned = cleaned.trim();

  const value = parseFloat(cleaned);

  if (isNaN(value)) {
    return 0;
  }

  return isNegativeParens ? -value : value;
}

/**
 * Parse various date formats (UTC)
 */
export function parsePaymentDate(dateStr: string): Date | null {
  if (!dateStr || !dateStr.trim()) {
    return null;
  }

  let cleaned = dateStr.trim();

  // YYYY-MM-DD HH:MM:SS or YYYY-MM-DD HH:MM → keep only the date part
  const datetimeMatch = cleaned.match(/^(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}/);
  if (datetimeMatch) {
    cleaned = datetimeMatch[1];
  }

  // Korean date format (year/month/day suffixes, with or without spaces), as found in
  // Korean exports. The Korean suffixes in the regex below are functional and must stay.
  const koreanMatch = cleaned.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (koreanMatch) {
    const year = parseInt(koreanMatch[1], 10);
    const month = parseInt(koreanMatch[2], 10) - 1;
    const day = parseInt(koreanMatch[3], 10);
    const date = new Date(Date.UTC(year, month, day));
    return isNaN(date.getTime()) ? null : date;
  }

  // YYYYMMDD (8 digits)
  if (/^\d{8}$/.test(cleaned)) {
    const year = parseInt(cleaned.substring(0, 4), 10);
    const month = parseInt(cleaned.substring(4, 6), 10) - 1;
    const day = parseInt(cleaned.substring(6, 8), 10);
    const date = new Date(Date.UTC(year, month, day));
    return isNaN(date.getTime()) ? null : date;
  }

  // YY.MM.DD
  if (/^\d{2}\.\d{2}\.\d{2}$/.test(cleaned)) {
    const parts = cleaned.split(".");
    const year = 2000 + parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(Date.UTC(year, month, day));
    return isNaN(date.getTime()) ? null : date;
  }

  // YYYY.MM.DD
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(cleaned)) {
    const parts = cleaned.split(".");
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(Date.UTC(year, month, day));
    return isNaN(date.getTime()) ? null : date;
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const standardized = cleaned.replace(/\//g, "-");
  // If it is YYYY-MM-DD, parse it as UTC
  if (/^\d{4}-\d{2}-\d{2}$/.test(standardized)) {
    const [year, month, day] = standardized.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return isNaN(date.getTime()) ? null : date;
  }

  // Other formats
  const date = new Date(standardized);
  if (!isNaN(date.getTime())) {
    return date;
  }

  return null;
}

/**
 * Header matching function
 */
function matchHeader(
  headers: string[],
  patterns: string[]
): string | undefined {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
  for (const pattern of patterns) {
    const idx = lowerHeaders.findIndex(
      (h) => h === pattern.toLowerCase() || h.includes(pattern.toLowerCase())
    );
    if (idx !== -1) {
      return headers[idx];
    }
  }
  return undefined;
}

/**
 * Detect the CSV format, including per-vendor ERP sub-formats
 */
export function detectCSVFormat(headers: string[]): PaymentCSVFormat {
  // Detect the Korean card company format
  const hasKoreanDate = matchHeader(headers, CARD_COMPANY_HEADERS.date);
  const hasKoreanMerchant = matchHeader(headers, CARD_COMPANY_HEADERS.merchant);
  const hasKoreanAmount = matchHeader(headers, CARD_COMPANY_HEADERS.amount);

  if (hasKoreanDate && hasKoreanMerchant && hasKoreanAmount) {
    return "CARD_COMPANY";
  }

  // Detect ERP sub-formats (specific vendors first)

  // Douzone iCUBE: debit account code + credit account code are the key identifiers
  const hasDuzonDebit = matchHeader(
    headers,
    ERP_DUZON_ICUBE_HEADERS.debitAccount
  );
  const hasDuzonCredit = matchHeader(
    headers,
    ERP_DUZON_ICUBE_HEADERS.creditAccount
  );
  const hasDuzonDate = matchHeader(headers, ERP_DUZON_ICUBE_HEADERS.date);
  if (hasDuzonDebit && hasDuzonCredit && hasDuzonDate) {
    // iCUBE vs WEHAGO: a management number column means iCUBE
    const hasManagementNumber = matchHeader(
      headers,
      ERP_DUZON_ICUBE_HEADERS.managementNumber
    );
    if (hasManagementNumber) {
      return "ERP_DUZON_ICUBE";
    }
    return "ERP_DUZON_WEHAGO";
  }

  // SAP FI: PostingDate + GLAccount are the key identifiers
  const hasSAPDate = matchHeader(headers, ERP_SAP_FI_HEADERS.date);
  const hasSAPGL = matchHeader(headers, ERP_SAP_FI_HEADERS.glAccount);
  const hasSAPAmount = matchHeader(headers, ERP_SAP_FI_HEADERS.amount);
  if (hasSAPDate && hasSAPGL && hasSAPAmount) {
    return "ERP_SAP_FI";
  }

  // Oracle Journal: AccountingDate + EnteredDebit/EnteredCredit are the key identifiers
  const hasOracleDate = matchHeader(headers, ERP_ORACLE_JOURNAL_HEADERS.date);
  const hasOracleDebit = matchHeader(
    headers,
    ERP_ORACLE_JOURNAL_HEADERS.debitAmount
  );
  const hasOracleCredit = matchHeader(
    headers,
    ERP_ORACLE_JOURNAL_HEADERS.creditAmount
  );
  if (hasOracleDate && (hasOracleDebit || hasOracleCredit)) {
    return "ERP_ORACLE_JOURNAL";
  }

  // ECOUNT: similar to generic ERP, distinguished by the account + description combination
  const hasEcountDate = matchHeader(headers, ERP_ECOUNT_HEADERS.date);
  const hasEcountMerchant = matchHeader(headers, ERP_ECOUNT_HEADERS.merchant);
  const hasEcountAmount = matchHeader(headers, ERP_ECOUNT_HEADERS.amount);
  const hasEcountCategory = matchHeader(headers, ERP_ECOUNT_HEADERS.category);
  if (
    hasEcountDate &&
    hasEcountMerchant &&
    hasEcountAmount &&
    hasEcountCategory
  ) {
    return "ERP_ECOUNT";
  }

  // Detect the generic ERP format (original logic)
  const hasERPDate = matchHeader(headers, ERP_HEADERS.date);
  const hasERPMerchant = matchHeader(headers, ERP_HEADERS.merchant);
  const hasERPAmount = matchHeader(headers, ERP_HEADERS.amount);

  if (hasERPDate && hasERPMerchant && hasERPAmount) {
    return "ERP";
  }

  // Detect the English card company format
  const hasEnDate = matchHeader(headers, CARD_COMPANY_EN_HEADERS.date);
  const hasEnMerchant = matchHeader(headers, CARD_COMPANY_EN_HEADERS.merchant);
  const hasEnAmount = matchHeader(headers, CARD_COMPANY_EN_HEADERS.amount);

  if (hasEnDate && hasEnMerchant && hasEnAmount) {
    return "CARD_COMPANY_EN";
  }

  return "UNKNOWN";
}

/**
 * Extract the last 4 digits of a card number
 */
function extractCardLast4(cardNumber: string | undefined): string | undefined {
  if (!cardNumber) return undefined;

  // Keep digits only
  const digits = cardNumber.replace(/\D/g, "");

  if (digits.length >= 4) {
    return digits.slice(-4);
  }

  return undefined;
}

/**
 * Convert raw data into the normalised format
 */
export function normalizePaymentData(
  row: Record<string, string>,
  format: PaymentCSVFormat
): PaymentCSVRow | null {
  const headers = Object.keys(row);

  let dateField: string | undefined;
  let merchantField: string | undefined;
  let amountField: string | undefined;
  let cardField: string | undefined;
  let approvalField: string | undefined;
  let categoryField: string | undefined;
  let memoField: string | undefined;

  switch (format) {
    case "CARD_COMPANY":
      dateField = matchHeader(headers, CARD_COMPANY_HEADERS.date);
      merchantField = matchHeader(headers, CARD_COMPANY_HEADERS.merchant);
      amountField = matchHeader(headers, CARD_COMPANY_HEADERS.amount);
      cardField = matchHeader(headers, CARD_COMPANY_HEADERS.cardNumber);
      approvalField = matchHeader(headers, CARD_COMPANY_HEADERS.approval);
      break;

    case "ERP":
    case "ERP_GENERIC":
    case "ERP_ECOUNT":
      dateField = matchHeader(headers, ERP_HEADERS.date);
      merchantField = matchHeader(headers, ERP_HEADERS.merchant);
      amountField = matchHeader(headers, ERP_HEADERS.amount);
      categoryField = matchHeader(headers, ERP_HEADERS.category);
      memoField = matchHeader(headers, ERP_HEADERS.memo);
      break;

    case "ERP_DUZON_ICUBE":
    case "ERP_DUZON_WEHAGO":
      dateField = matchHeader(headers, ERP_DUZON_ICUBE_HEADERS.date);
      merchantField = matchHeader(headers, ERP_DUZON_ICUBE_HEADERS.merchant);
      amountField = matchHeader(headers, ERP_DUZON_ICUBE_HEADERS.amount);
      memoField = matchHeader(headers, ERP_DUZON_ICUBE_HEADERS.memo);
      // Map the debit account name to category
      categoryField = matchHeader(
        headers,
        ERP_DUZON_ICUBE_HEADERS.debitAccountName
      );
      break;

    case "ERP_SAP_FI":
      dateField = matchHeader(headers, ERP_SAP_FI_HEADERS.date);
      merchantField = matchHeader(headers, ERP_SAP_FI_HEADERS.supplier);
      amountField = matchHeader(headers, ERP_SAP_FI_HEADERS.amount);
      categoryField = matchHeader(headers, ERP_SAP_FI_HEADERS.glAccountName);
      memoField = matchHeader(headers, ERP_SAP_FI_HEADERS.documentText);
      break;

    case "ERP_ORACLE_JOURNAL":
      dateField = matchHeader(headers, ERP_ORACLE_JOURNAL_HEADERS.date);
      merchantField = matchHeader(
        headers,
        ERP_ORACLE_JOURNAL_HEADERS.description
      );
      amountField = matchHeader(
        headers,
        ERP_ORACLE_JOURNAL_HEADERS.debitAmount
      );
      categoryField = matchHeader(
        headers,
        ERP_ORACLE_JOURNAL_HEADERS.accountClass
      );
      break;

    case "CUSTOM":
      // CUSTOM formats must supply their mapping externally, so use the default ERP logic here
      dateField = matchHeader(headers, ERP_HEADERS.date);
      merchantField = matchHeader(headers, ERP_HEADERS.merchant);
      amountField = matchHeader(headers, ERP_HEADERS.amount);
      categoryField = matchHeader(headers, ERP_HEADERS.category);
      memoField = matchHeader(headers, ERP_HEADERS.memo);
      break;

    case "CARD_COMPANY_EN":
      dateField = matchHeader(headers, CARD_COMPANY_EN_HEADERS.date);
      merchantField = matchHeader(headers, CARD_COMPANY_EN_HEADERS.merchant);
      amountField = matchHeader(headers, CARD_COMPANY_EN_HEADERS.amount);
      cardField = matchHeader(headers, CARD_COMPANY_EN_HEADERS.cardNumber);
      approvalField = matchHeader(headers, CARD_COMPANY_EN_HEADERS.approval);
      break;

    default:
      return null;
  }

  if (!dateField || !merchantField || !amountField) {
    return null;
  }

  const transactionDate = parsePaymentDate(row[dateField]);
  const merchantName = row[merchantField]?.trim();
  const amount = parsePaymentAmount(row[amountField]);

  if (!transactionDate || !merchantName) {
    return null;
  }

  const result: PaymentCSVRow = {
    transactionDate,
    merchantName,
    amount,
    rawData: row,
  };

  if (cardField && row[cardField]) {
    result.cardLast4 = extractCardLast4(row[cardField]);
  }

  if (approvalField && row[approvalField]) {
    result.approvalNumber = row[approvalField].trim();
  }

  if (categoryField && row[categoryField]) {
    result.category = row[categoryField].trim();
  }

  if (memoField && row[memoField]) {
    result.memo = row[memoField].trim();
  }

  return result;
}

/**
 * Scan CSV rows to find the index of the actual header row.
 * Handles files such as bank statements that have title/summary rows at the top.
 */
function findHeaderRow(lines: string[], maxScanRows: number = 20): number {
  const headerKeywords = [
    ...CARD_COMPANY_HEADERS.date,
    ...CARD_COMPANY_HEADERS.merchant,
    ...CARD_COMPANY_HEADERS.amount,
    ...ERP_HEADERS.date,
    ...ERP_HEADERS.merchant,
    ...ERP_HEADERS.amount,
    ...ERP_DUZON_ICUBE_HEADERS.date,
    ...ERP_DUZON_ICUBE_HEADERS.debitAccount,
    ...ERP_SAP_FI_HEADERS.date,
    ...ERP_SAP_FI_HEADERS.glAccount,
    ...ERP_ORACLE_JOURNAL_HEADERS.date,
    ...ERP_ORACLE_JOURNAL_HEADERS.debitAmount,
    ...CARD_COMPANY_EN_HEADERS.date,
    ...CARD_COMPANY_EN_HEADERS.merchant,
    ...CARD_COMPANY_EN_HEADERS.amount,
  ];

  const limit = Math.min(lines.length, maxScanRows);
  for (let i = 0; i < limit; i++) {
    const line = lines[i].toLowerCase();
    const matchCount = headerKeywords.filter((kw) =>
      line.includes(kw.toLowerCase())
    ).length;
    if (matchCount >= 2) {
      return i;
    }
  }
  return 0;
}

/**
 * Main payment CSV parsing function
 */
export function parsePaymentCSV(csvContent: string): PaymentCSVParseResult {
  // Strip the UTF-8 BOM
  let content = csvContent;
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.substring(1);
  }

  if (!content.trim()) {
    return {
      success: false,
      error: "The CSV file is empty",
    };
  }

  // Auto-detect the header row (skip non-data rows at the top, e.g. bank statements)
  const lines = content.split(/\r?\n/);
  const headerRowIndex = findHeaderRow(lines);
  const effectiveContent =
    headerRowIndex > 0 ? lines.slice(headerRowIndex).join("\n") : content;

  // Reuse the existing CSV parser
  const rows = parseCSV(effectiveContent);

  if (rows.length === 0) {
    return {
      success: false,
      error: "No data available",
    };
  }

  // Extract headers (keys of the first row)
  const headers = Object.keys(rows[0]);

  // Detect format
  const format = detectCSVFormat(headers);

  if (format === "UNKNOWN") {
    return {
      success: false,
      error: "Unsupported CSV format",
    };
  }

  // Normalise and validate data
  const data: PaymentCSVRow[] = [];
  const errors: PaymentValidationError[] = [];

  rows.forEach((row, index) => {
    const rowNum = index + 1;

    const normalized = normalizePaymentData(row, format);

    if (!normalized) {
      // Check for missing required fields
      const headersList = Object.keys(row);
      let dateField: string | undefined;
      let merchantField: string | undefined;

      if (format === "CARD_COMPANY") {
        dateField = matchHeader(headersList, CARD_COMPANY_HEADERS.date);
        merchantField = matchHeader(headersList, CARD_COMPANY_HEADERS.merchant);
      } else if (isERPFormat(format)) {
        // ERP formats use vendor-specific headers, falling back to generic ERP headers
        if (format === "ERP_DUZON_ICUBE" || format === "ERP_DUZON_WEHAGO") {
          dateField = matchHeader(headersList, ERP_DUZON_ICUBE_HEADERS.date);
          merchantField = matchHeader(
            headersList,
            ERP_DUZON_ICUBE_HEADERS.merchant
          );
        } else if (format === "ERP_SAP_FI") {
          dateField = matchHeader(headersList, ERP_SAP_FI_HEADERS.date);
          merchantField = matchHeader(headersList, ERP_SAP_FI_HEADERS.supplier);
        } else if (format === "ERP_ORACLE_JOURNAL") {
          dateField = matchHeader(headersList, ERP_ORACLE_JOURNAL_HEADERS.date);
          merchantField = matchHeader(
            headersList,
            ERP_ORACLE_JOURNAL_HEADERS.description
          );
        } else {
          dateField = matchHeader(headersList, ERP_HEADERS.date);
          merchantField = matchHeader(headersList, ERP_HEADERS.merchant);
        }
      } else if (format === "CARD_COMPANY_EN") {
        dateField = matchHeader(headersList, CARD_COMPANY_EN_HEADERS.date);
        merchantField = matchHeader(
          headersList,
          CARD_COMPANY_EN_HEADERS.merchant
        );
      }

      if (dateField && !parsePaymentDate(row[dateField])) {
        errors.push({
          row: rowNum,
          field: "date",
          message: `Row ${rowNum}: Invalid date format`,
        });
      }

      if (merchantField && !row[merchantField]?.trim()) {
        errors.push({
          row: rowNum,
          field: "merchant",
          message: `Row ${rowNum}: Merchant name is required`,
        });
      }

      return;
    }

    data.push(normalized);
  });

  return {
    success: true,
    format,
    data,
    errors: errors.length > 0 ? errors : undefined,
  };
}
