// src/lib/erp-format-presets.ts
// Per-ERP preset registry - Layer 1 of the 3-layer generic parsing strategy
//
// NOTE: the Korean header names, field names and skip patterns in this file are functional.
// They must match the column headers and account names exported verbatim by Korean ERP
// systems (Douzone iCUBE/WEHAGO, ECOUNT, generic Korean ERP exports) and must not be translated.

import type { PaymentCSVFormat } from "./payment-csv";

// ============================================================
// Types
// ============================================================

/** Double-entry conversion mode */
export type DoubleEntryMode =
  | "DEBIT_EXPENSE_ONLY" // Extract only expense accounts from debits
  | "DEBIT_ALL" // Extract all debit entries
  | "NET_AMOUNT" // Compute net amount (debit - credit)
  | "NONE"; // Not double-entry (single entry)

/** Double-entry settings */
export interface DoubleEntryConfig {
  mode: DoubleEntryMode;
  /** Debit account code/name column */
  debitAccountField?: string;
  /** Credit account code/name column */
  creditAccountField?: string;
  /** Expense account prefixes (e.g. ["8", "6"] → 8xxx, 6xxx) */
  expenseAccountPrefixes: string[];
  /** VAT account code prefixes (input VAT etc. → added to the main expense) */
  vatAccountPrefixes: string[];
}

/** SaaS name extraction settings */
export interface MerchantExtractConfig {
  /** Extraction priority (field names, tried in order) */
  fieldPriority: string[];
  /** Meaningless value patterns (values matching these are skipped) */
  skipPatterns: string[];
}

/** Auto-detection rule */
export interface AutoDetectRule {
  /** Required headers (all must be present to match) */
  requiredHeaders: string[];
  /** Optional distinguishing headers (higher priority when present) */
  distinctiveHeaders?: string[];
}

/** Header mapping settings */
export interface HeaderMapping {
  date: string[];
  merchant: string[];
  amount: string[];
  category?: string[];
  memo?: string[];
  debitAccount?: string[];
  debitAccountName?: string[];
  creditAccount?: string[];
  creditAccountName?: string[];
  debitAmount?: string[];
  creditAmount?: string[];
  [key: string]: string[] | undefined;
}

/** Complete ERP format preset */
export interface ERPFormatPreset {
  format: PaymentCSVFormat;
  name: string;
  description: string;
  headerMapping: HeaderMapping;
  doubleEntry: DoubleEntryConfig;
  merchantExtract: MerchantExtractConfig;
  autoDetect: AutoDetectRule;
}

// ============================================================
// Preset Definitions
// ============================================================

const DUZON_ICUBE_PRESET: ERPFormatPreset = {
  format: "ERP_DUZON_ICUBE",
  name: "Douzone iCUBE",
  description: "Douzone iCUBE automatic voucher Excel template",
  headerMapping: {
    date: ["전표일자"],
    merchant: ["거래처명"],
    amount: ["금액"],
    memo: ["적요"],
    debitAccount: ["차변계정코드"],
    debitAccountName: ["차변계정명"],
    creditAccount: ["대변계정코드"],
    creditAccountName: ["대변계정명"],
  },
  doubleEntry: {
    mode: "DEBIT_EXPENSE_ONLY",
    debitAccountField: "차변계정코드",
    creditAccountField: "대변계정코드",
    expenseAccountPrefixes: ["8"], // 8xxx = SG&A / expenses
    vatAccountPrefixes: ["135"], // 13500 = input VAT
  },
  merchantExtract: {
    fieldPriority: ["적요", "거래처명", "비고"],
    skipPatterns: [
      "카드결제",
      "법인카드",
      "미지급금",
      "보통예금",
      "현금",
      "당좌예금",
    ],
  },
  autoDetect: {
    requiredHeaders: ["전표일자", "차변계정코드", "대변계정코드"],
    distinctiveHeaders: ["관리번호"],
  },
};

const DUZON_WEHAGO_PRESET: ERPFormatPreset = {
  format: "ERP_DUZON_WEHAGO",
  name: "Douzone WEHAGO",
  description: "Douzone WEHAGO/Amaranth10 automatic voucher template",
  headerMapping: {
    date: ["전표일자", "일자"],
    merchant: ["거래처명", "거래처"],
    amount: ["금액"],
    memo: ["적요"],
    debitAccount: ["차변계정코드", "차변코드"],
    debitAccountName: ["차변계정명", "차변과목"],
    creditAccount: ["대변계정코드", "대변코드"],
    creditAccountName: ["대변계정명", "대변과목"],
  },
  doubleEntry: {
    mode: "DEBIT_EXPENSE_ONLY",
    debitAccountField: "차변계정코드",
    creditAccountField: "대변계정코드",
    expenseAccountPrefixes: ["8"],
    vatAccountPrefixes: ["135"],
  },
  merchantExtract: {
    fieldPriority: ["적요", "거래처명", "비고"],
    skipPatterns: [
      "카드결제",
      "법인카드",
      "미지급금",
      "보통예금",
      "현금",
      "당좌예금",
    ],
  },
  autoDetect: {
    requiredHeaders: ["전표일자", "차변계정코드", "대변계정코드"],
  },
};

const SAP_FI_PRESET: ERPFormatPreset = {
  format: "ERP_SAP_FI",
  name: "SAP S/4HANA FI",
  description: "SAP S/4HANA Financial Accounting OData template",
  headerMapping: {
    date: ["PostingDate", "DocumentDate"],
    merchant: ["SupplierName", "Supplier"],
    amount: ["AmountInCompanyCodeCurrency", "Amount"],
    category: ["GLAccountName"],
    memo: ["DocumentItemText"],
    debitAccount: ["GLAccount"],
  },
  doubleEntry: {
    mode: "DEBIT_EXPENSE_ONLY",
    debitAccountField: "GLAccount",
    expenseAccountPrefixes: ["6", "8"], // 6xxx = expenses, 8xxx = SG&A
    vatAccountPrefixes: ["154"], // Input VAT related
  },
  merchantExtract: {
    fieldPriority: ["SupplierName", "DocumentItemText", "GLAccountName"],
    skipPatterns: [
      "CLEARING",
      "PAYMENT",
      "BANK TRANSFER",
      "CASH",
      "PREPAYMENT",
    ],
  },
  autoDetect: {
    requiredHeaders: [
      "PostingDate",
      "GLAccount",
      "AmountInCompanyCodeCurrency",
    ],
  },
};

const ORACLE_JOURNAL_PRESET: ERPFormatPreset = {
  format: "ERP_ORACLE_JOURNAL",
  name: "Oracle ERP Cloud Journal",
  description: "Oracle ERP Cloud General Ledger Journal template",
  headerMapping: {
    date: ["AccountingDate", "JournalDate"],
    merchant: ["Description", "LineDescription"],
    amount: ["EnteredDebit", "DebitAmount"],
    category: ["AccountClass", "AccountType"],
    debitAmount: ["EnteredDebit", "DebitAmount"],
    creditAmount: ["EnteredCredit", "CreditAmount"],
  },
  doubleEntry: {
    mode: "DEBIT_EXPENSE_ONLY",
    debitAccountField: "AccountClass",
    expenseAccountPrefixes: ["EXPENSE"],
    vatAccountPrefixes: ["TAX"],
  },
  merchantExtract: {
    fieldPriority: ["Description", "LineDescription", "JournalName"],
    skipPatterns: [
      "CLEARING",
      "PAYMENT",
      "BANK",
      "CASH",
      "ACCRUAL",
      "REVERSAL",
    ],
  },
  autoDetect: {
    requiredHeaders: ["AccountingDate", "EnteredDebit"],
    distinctiveHeaders: ["EnteredCredit"],
  },
};

const ECOUNT_PRESET: ERPFormatPreset = {
  format: "ERP_ECOUNT",
  name: "ECOUNT",
  description: "ECOUNT ERP Excel export template",
  headerMapping: {
    date: ["일자", "날짜"],
    merchant: ["거래처", "거래처명"],
    amount: ["금액", "출금"],
    category: ["계정과목"],
    memo: ["적요", "비고"],
  },
  doubleEntry: {
    mode: "NONE",
    expenseAccountPrefixes: [],
    vatAccountPrefixes: [],
  },
  merchantExtract: {
    fieldPriority: ["거래처명", "거래처", "적요", "비고"],
    skipPatterns: ["카드결제", "법인카드", "미지급금", "보통예금", "현금"],
  },
  autoDetect: {
    requiredHeaders: ["일자", "거래처", "금액", "계정과목"],
  },
};

const GENERIC_ERP_PRESET: ERPFormatPreset = {
  format: "ERP_GENERIC",
  name: "Generic ERP",
  description: "Generic ERP format (standard Korean headers)",
  headerMapping: {
    date: ["거래일자", "일자", "전표일자"],
    merchant: ["거래처명", "거래처", "상대계정"],
    amount: ["출금액", "지출액", "금액", "차변"],
    category: ["계정과목", "계정", "과목"],
    memo: ["비고", "적요", "메모"],
  },
  doubleEntry: {
    mode: "NONE",
    expenseAccountPrefixes: [],
    vatAccountPrefixes: [],
  },
  merchantExtract: {
    fieldPriority: ["거래처명", "거래처", "적요", "비고"],
    skipPatterns: ["카드결제", "법인카드", "미지급금", "보통예금", "현금"],
  },
  autoDetect: {
    requiredHeaders: ["거래일자", "거래처명", "출금액"],
  },
};

// ============================================================
// Registry
// ============================================================

const PRESET_REGISTRY: Map<PaymentCSVFormat, ERPFormatPreset> = new Map([
  ["ERP_DUZON_ICUBE", DUZON_ICUBE_PRESET],
  ["ERP_DUZON_WEHAGO", DUZON_WEHAGO_PRESET],
  ["ERP_SAP_FI", SAP_FI_PRESET],
  ["ERP_ORACLE_JOURNAL", ORACLE_JOURNAL_PRESET],
  ["ERP_ECOUNT", ECOUNT_PRESET],
  ["ERP_GENERIC", GENERIC_ERP_PRESET],
]);

/**
 * Return the preset for a format
 */
export function getPreset(
  format: PaymentCSVFormat
): ERPFormatPreset | undefined {
  return PRESET_REGISTRY.get(format);
}

/**
 * Auto-detect the best-matching preset from CSV headers
 * Tries specific vendors first, then falls back to generic
 */
export function detectPreset(headers: string[]): ERPFormatPreset | undefined {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  // Match specific vendors first (presets with distinctive headers take priority)
  const presetsWithDistinctive: ERPFormatPreset[] = [];
  const presetsWithoutDistinctive: ERPFormatPreset[] = [];

  for (const preset of PRESET_REGISTRY.values()) {
    if (
      preset.autoDetect.distinctiveHeaders &&
      preset.autoDetect.distinctiveHeaders.length > 0
    ) {
      presetsWithDistinctive.push(preset);
    } else {
      presetsWithoutDistinctive.push(preset);
    }
  }

  // Step 1: check presets with distinctive headers first
  for (const preset of presetsWithDistinctive) {
    const requiredMatch = preset.autoDetect.requiredHeaders.every((rh) =>
      lowerHeaders.some(
        (h) => h === rh.toLowerCase() || h.includes(rh.toLowerCase())
      )
    );
    const distinctiveMatch = preset.autoDetect.distinctiveHeaders!.every((dh) =>
      lowerHeaders.some(
        (h) => h === dh.toLowerCase() || h.includes(dh.toLowerCase())
      )
    );
    if (requiredMatch && distinctiveMatch) {
      return preset;
    }
  }

  // Step 2: match on required headers only
  for (const preset of [
    ...presetsWithDistinctive,
    ...presetsWithoutDistinctive,
  ]) {
    const requiredMatch = preset.autoDetect.requiredHeaders.every((rh) =>
      lowerHeaders.some(
        (h) => h === rh.toLowerCase() || h.includes(rh.toLowerCase())
      )
    );
    if (requiredMatch) {
      return preset;
    }
  }

  return undefined;
}

/**
 * Return all registered presets
 */
export function getAllPresets(): ERPFormatPreset[] {
  return Array.from(PRESET_REGISTRY.values());
}

/**
 * Register a custom preset (new presets can be added at runtime)
 */
export function registerPreset(preset: ERPFormatPreset): void {
  PRESET_REGISTRY.set(preset.format, preset);
}
