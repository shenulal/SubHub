// src/lib/services/export/csv.ts
/**
 * CSV export service
 * Utilities for converting data to CSV
 */

export interface CSVColumn<T = Record<string, unknown>> {
  key: keyof T | string;
  header: string;
  formatter?: (value: unknown, row: T) => string;
}

export interface CSVOptions {
  includeBOM?: boolean;
  delimiter?: string;
}

/**
 * Escapes a CSV value
 * Escapes values containing commas, quotes or line breaks
 */
export function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  // Wrap in quotes when the value contains commas, quotes or line breaks
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    // Escape quotes by doubling them
    const escaped = stringValue.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return stringValue;
}

/**
 * Formats a currency amount
 */
export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_BASE_CURRENCY
): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currencyDecimals(currency),
  });
  return formatter.format(amount);
}

/**
 * Formats a date (YYYY-MM-DD)
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) {
    return "";
  }

  const d = typeof date === "string" ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return "";
  }

  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Builds the CSV string
 */
export function generateCSV<T>(
  columns: CSVColumn<T>[],
  data: T[],
  options: CSVOptions = {}
): string {
  const { includeBOM = false, delimiter = "," } = options;

  // Build the header row
  const headers = columns
    .map((col) => escapeCSVValue(col.header))
    .join(delimiter);

  // Build the data rows
  const rows = data.map((row) => {
    return columns
      .map((col) => {
        const value = row[col.key as keyof T];
        const formattedValue = col.formatter
          ? col.formatter(value, row)
          : value;
        return escapeCSVValue(formattedValue);
      })
      .join(delimiter);
  });

  // Assemble the CSV string
  const csvContent = [headers, ...rows].join("\n");

  // Add a BOM (so Excel reads non-ASCII characters correctly)
  if (includeBOM) {
    return "\uFEFF" + csvContent;
  }

  return csvContent;
}

/**
 * Creates a CSV Blob (for download)
 */
export function createCSVBlob(csvContent: string): Blob {
  return new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
}

/**
 * Triggers a CSV download (client side)
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = createCSVBlob(csvContent);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
import { currencyDecimals, DEFAULT_BASE_CURRENCY } from "@/lib/fx/convert";
