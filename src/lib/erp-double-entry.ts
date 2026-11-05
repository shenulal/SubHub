// src/lib/erp-double-entry.ts
// Double-entry → single-entry conversion engine
// Converts the debit/credit structure of ERP data into single SubHub PaymentCSVRow entries

import type { DoubleEntryConfig } from "./erp-format-presets";

/** Raw double-entry row */
export interface DoubleEntryRow {
  /** Raw CSV row data */
  rawData: Record<string, string>;
  /** Date string */
  date: string;
  /** Amount (unparsed string) */
  amount: string;
  /** Debit account code */
  debitAccount?: string;
  /** Debit account name */
  debitAccountName?: string;
  /** Credit account code */
  creditAccount?: string;
  /** Credit account name */
  creditAccountName?: string;
  /** Description/memo */
  memo?: string;
  /** Vendor name */
  merchant?: string;
}

/** Converted result row */
export interface ConvertedEntry {
  date: string;
  amount: number;
  merchant: string;
  category?: string;
  memo?: string;
  rawData: Record<string, string>;
  /** VAT amount added (tracked separately) */
  vatAmount?: number;
}

/**
 * Check whether an account code matches one of the given prefixes
 */
function matchesAccountPrefix(
  accountCode: string | undefined,
  prefixes: string[]
): boolean {
  if (!accountCode) return false;
  const cleaned = accountCode.replace(/^0+/, "").trim();
  return prefixes.some((prefix) => cleaned.startsWith(prefix));
}

/**
 * Check whether the row is an expense account row
 */
function isExpenseRow(row: DoubleEntryRow, config: DoubleEntryConfig): boolean {
  if (config.expenseAccountPrefixes.length === 0) return true;
  return matchesAccountPrefix(row.debitAccount, config.expenseAccountPrefixes);
}

/**
 * Check whether the row is a VAT (input VAT) row
 */
function isVATRow(row: DoubleEntryRow, config: DoubleEntryConfig): boolean {
  if (config.vatAccountPrefixes.length === 0) return false;
  return matchesAccountPrefix(row.debitAccount, config.vatAccountPrefixes);
}

/**
 * Convert an amount string to a number (simple version, compatible with parsePaymentAmount)
 */
function parseAmount(amountStr: string): number {
  if (!amountStr || !amountStr.trim()) return 0;
  let cleaned = amountStr.trim().replace(/[₩$€£¥,\s]/g, "");
  const isNegative = /^\(.*\)$/.test(cleaned);
  if (isNegative) cleaned = cleaned.replace(/[()]/g, "");
  const value = parseFloat(cleaned);
  if (isNaN(value)) return 0;
  return isNegative ? -value : value;
}

/**
 * Group rows by date (to keep debits/credits of the same voucher together)
 */
function groupByDate(rows: DoubleEntryRow[]): Map<string, DoubleEntryRow[]> {
  const groups = new Map<string, DoubleEntryRow[]>();
  for (const row of rows) {
    const key = row.date;
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }
  return groups;
}

/**
 * DEBIT_EXPENSE_ONLY mode: extract only expense accounts from debits
 * If there is a VAT (input VAT) row on the same date, add it to the expenses
 */
function convertDebitExpenseOnly(
  rows: DoubleEntryRow[],
  config: DoubleEntryConfig
): ConvertedEntry[] {
  const results: ConvertedEntry[] = [];
  const dateGroups = groupByDate(rows);

  for (const [, group] of dateGroups) {
    const expenseRows = group.filter((r) => isExpenseRow(r, config));
    const vatRows = group.filter((r) => isVATRow(r, config));

    // Total VAT (split across the expense rows)
    const totalVAT = vatRows.reduce((sum, r) => sum + parseAmount(r.amount), 0);
    const vatPerExpense =
      expenseRows.length > 0 ? totalVAT / expenseRows.length : 0;

    for (const row of expenseRows) {
      const baseAmount = parseAmount(row.amount);
      results.push({
        date: row.date,
        amount: baseAmount + vatPerExpense,
        merchant: row.merchant || row.memo || "",
        category: row.debitAccountName || row.debitAccount,
        memo: row.memo,
        rawData: row.rawData,
        vatAmount: vatPerExpense > 0 ? vatPerExpense : undefined,
      });
    }
  }

  return results;
}

/**
 * DEBIT_ALL mode: extract all debit entries
 */
function convertDebitAll(
  rows: DoubleEntryRow[],
  config: DoubleEntryConfig
): ConvertedEntry[] {
  return rows
    .filter((row) => {
      // Only rows with a debit account (exclude credit-only rows)
      return row.debitAccount && row.debitAccount.trim() !== "";
    })
    .filter((row) => !isVATRow(row, config))
    .map((row) => ({
      date: row.date,
      amount: parseAmount(row.amount),
      merchant: row.merchant || row.memo || "",
      category: row.debitAccountName || row.debitAccount,
      memo: row.memo,
      rawData: row.rawData,
    }));
}

/**
 * NET_AMOUNT mode: compute the net amount (debit - credit)
 */
function convertNetAmount(rows: DoubleEntryRow[]): ConvertedEntry[] {
  const dateGroups = groupByDate(rows);
  const results: ConvertedEntry[] = [];

  for (const [date, group] of dateGroups) {
    let totalDebit = 0;
    let totalCredit = 0;
    let merchant = "";
    let category = "";
    let memo = "";
    const rawData: Record<string, string> = {};

    for (const row of group) {
      const amount = parseAmount(row.amount);
      if (row.debitAccount && row.debitAccount.trim() !== "") {
        totalDebit += amount;
        if (!merchant) merchant = row.merchant || row.memo || "";
        if (!category)
          category = row.debitAccountName || row.debitAccount || "";
        if (!memo) memo = row.memo || "";
      }
      if (row.creditAccount && row.creditAccount.trim() !== "") {
        totalCredit += amount;
      }
      Object.assign(rawData, row.rawData);
    }

    const netAmount = totalDebit - totalCredit;
    if (netAmount > 0) {
      results.push({
        date,
        amount: netAmount,
        merchant,
        category,
        memo,
        rawData,
      });
    }
  }

  return results;
}

/**
 * Convert an array of double-entry rows into single entries
 *
 * @param rows - Raw double-entry rows
 * @param config - Double-entry settings (taken from the preset)
 * @returns Converted single-entry rows
 */
export function convertDoubleEntry(
  rows: DoubleEntryRow[],
  config: DoubleEntryConfig
): ConvertedEntry[] {
  switch (config.mode) {
    case "DEBIT_EXPENSE_ONLY":
      return convertDebitExpenseOnly(rows, config);
    case "DEBIT_ALL":
      return convertDebitAll(rows, config);
    case "NET_AMOUNT":
      return convertNetAmount(rows);
    case "NONE":
      // Not double-entry: return as-is
      return rows.map((row) => ({
        date: row.date,
        amount: parseAmount(row.amount),
        merchant: row.merchant || row.memo || "",
        category: row.debitAccountName,
        memo: row.memo,
        rawData: row.rawData,
      }));
  }
}
