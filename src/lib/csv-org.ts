// src/lib/csv-org.ts
/**
 * CSV parsing utilities for organisation/user sync
 * Reuses parseCSV() and detectDelimiter() from src/lib/csv.ts
 */

import type { ValidationError, ValidationResult } from "./csv";
import { parseCSV } from "./csv";

export type { ValidationError, ValidationResult };

// ==================== Type definitions ====================

export interface OrgCSVRow {
  org_code: string;
  parent_code: string;
  org_name: string;
}

export interface UserSyncCSVRow {
  employee_id: string;
  name: string;
  email: string;
  org_code: string;
}

// ==================== Validation ====================

/**
 * Validate the organisation CSV
 * - org_code and org_name are required
 * - Detect circular references via DFS
 */
export function validateOrgCSV(
  rows: Record<string, string>[]
): ValidationResult<OrgCSVRow> {
  const valid: OrgCSVRow[] = [];
  const errors: ValidationError[] = [];
  const seenCodes = new Set<string>();

  rows.forEach((row, index) => {
    const rowNum = index + 1;

    const org_code = row.org_code?.trim();
    const parent_code = row.parent_code?.trim() || "";
    const org_name = row.org_name?.trim();

    if (!org_code) {
      errors.push({
        row: rowNum,
        field: "org_code",
        message: `Row ${rowNum}: org_code is required`,
      });
      return;
    }

    if (!org_name) {
      errors.push({
        row: rowNum,
        field: "org_name",
        message: `Row ${rowNum}: org_name is required`,
      });
      return;
    }

    if (seenCodes.has(org_code)) {
      errors.push({
        row: rowNum,
        field: "org_code",
        message: `Row ${rowNum}: Duplicate org_code (${org_code})`,
      });
      return;
    }

    seenCodes.add(org_code);
    valid.push({ org_code, parent_code, org_name });
  });

  // Detect circular references via DFS
  if (valid.length > 0) {
    const circularErrors = detectCircularReferences(valid);
    errors.push(...circularErrors);

    if (circularErrors.length > 0) {
      return { valid: [], errors };
    }
  }

  return { valid, errors };
}

/**
 * Detect circular references using DFS
 */
function detectCircularReferences(rows: OrgCSVRow[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const codeMap = new Map<string, OrgCSVRow>();
  rows.forEach((r) => codeMap.set(r.org_code, r));

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(code: string): boolean {
    if (inStack.has(code)) return true; // Circular reference
    if (visited.has(code)) return false;

    visited.add(code);
    inStack.add(code);

    const row = codeMap.get(code);
    if (row?.parent_code && codeMap.has(row.parent_code)) {
      if (dfs(row.parent_code)) {
        return true;
      }
    }

    inStack.delete(code);
    return false;
  }

  for (const row of rows) {
    if (dfs(row.org_code)) {
      errors.push({
        row: 0,
        field: "parent_code",
        message: `Circular reference detected (${row.org_code})`,
      });
      break;
    }
  }

  return errors;
}

/**
 * Validate the user sync CSV
 * - name, email and org_code are required
 * - Validate email format
 */
export function validateUserSyncCSV(
  rows: Record<string, string>[]
): ValidationResult<UserSyncCSVRow> {
  const valid: UserSyncCSVRow[] = [];
  const errors: ValidationError[] = [];
  const seenEmails = new Set<string>();

  rows.forEach((row, index) => {
    const rowNum = index + 1;

    const name = row.name?.trim();
    const email = row.email?.trim().toLowerCase();
    const org_code = row.org_code?.trim();
    const employee_id = row.employee_id?.trim() || "";

    if (!name) {
      errors.push({
        row: rowNum,
        field: "name",
        message: `Row ${rowNum}: name is required`,
      });
      return;
    }

    if (!email) {
      errors.push({
        row: rowNum,
        field: "email",
        message: `Row ${rowNum}: email is required`,
      });
      return;
    }

    if (!isValidEmail(email)) {
      errors.push({
        row: rowNum,
        field: "email",
        message: `Row ${rowNum}: Invalid email format (${email})`,
      });
      return;
    }

    if (seenEmails.has(email)) {
      errors.push({
        row: rowNum,
        field: "email",
        message: `Row ${rowNum}: Duplicate email (${email})`,
      });
      return;
    }

    if (!org_code) {
      errors.push({
        row: rowNum,
        field: "org_code",
        message: `Row ${rowNum}: org_code is required`,
      });
      return;
    }

    seenEmails.add(email);
    valid.push({ employee_id, name, email, org_code });
  });

  return { valid, errors };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ==================== CSV parser re-export ====================

export { parseCSV };

// ==================== Template generation ====================

export function generateOrgCSVTemplate(): string {
  return `org_code,parent_code,org_name
ORG001,,Head Office
ORG002,ORG001,Engineering
ORG003,ORG001,Sales
ORG004,ORG002,Frontend Team`;
}

export function generateUserSyncCSVTemplate(): string {
  return `employee_id,name,email,org_code
EMP001,Ahmed Al Mansoori,ahmed@company.com,ORG002
EMP002,Sara Khan,sara@company.com,ORG003`;
}
