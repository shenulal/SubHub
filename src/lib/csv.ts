// src/lib/csv.ts

// Valid app categories
const VALID_CATEGORIES = [
  "COLLABORATION",
  "PRODUCTIVITY",
  "DEVELOPMENT",
  "DESIGN",
  "MARKETING",
  "SALES",
  "HR",
  "FINANCE",
  "ANALYTICS",
  "SECURITY",
  "IT_INFRA",
  "COMMUNICATION",
  "OTHER",
] as const;

// Valid billing cycles
const VALID_BILLING_CYCLES = ["MONTHLY", "QUARTERLY", "YEARLY"] as const;

export interface AppCSVRow {
  name: string;
  category: string;
  vendor?: string;
  description?: string;
  website?: string;
}

export interface SubscriptionCSVRow {
  appName: string;
  planName: string;
  billingCycle: string;
  price?: string;
  renewalDate?: string;
  seats?: string;
}

export interface UserCSVRow {
  email: string;
  name?: string;
  role: string;
  department?: string;
  jobTitle?: string;
  employeeId?: string;
}

// Valid user roles
const VALID_USER_ROLES = ["ADMIN", "APPROVER", "MEMBER", "VIEWER"] as const;

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ValidationResult<T> {
  valid: T[];
  errors: ValidationError[];
}

/**
 * Auto-detect the delimiter (tab vs comma)
 */
function detectDelimiter(line: string): string {
  const commaCount = (line.match(/,/g) || []).length;
  const tabCount = (line.match(/\t/g) || []).length;
  return tabCount > commaCount ? "\t" : ",";
}

/**
 * Parse a CSV string into an array of objects
 */
export function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Detect the delimiter from the first line
  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCSVLine(lines[0], delimiter);
  const results: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line, delimiter);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || "";
    });

    results.push(row);
  }

  return results;
}

/**
 * Parse a CSV line (handles quotes)
 */
function parseCSVLine(line: string, delimiter: string = ","): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Validate app CSV data
 */
export function validateAppCSV(
  rows: Record<string, string>[]
): ValidationResult<AppCSVRow> {
  const valid: AppCSVRow[] = [];
  const errors: ValidationError[] = [];

  rows.forEach((row, index) => {
    const rowNum = index + 1;

    // Validate required fields
    if (!row.name?.trim()) {
      errors.push({
        row: rowNum,
        field: "name",
        message: `Row ${rowNum}: App name is required`,
      });
      return;
    }

    if (!row.category?.trim()) {
      errors.push({
        row: rowNum,
        field: "category",
        message: `Row ${rowNum}: Category is required`,
      });
      return;
    }

    // Validate category
    const category = row.category.trim().toUpperCase();
    if (
      !VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])
    ) {
      errors.push({
        row: rowNum,
        field: "category",
        message: `Row ${rowNum}: Invalid category (${category}). Allowed values: ${VALID_CATEGORIES.join(", ")}`,
      });
      return;
    }

    valid.push({
      name: row.name.trim(),
      category: category,
      vendor: row.vendor?.trim() || undefined,
      description: row.description?.trim() || undefined,
      website: row.website?.trim() || undefined,
    });
  });

  return { valid, errors };
}

/**
 * Validate subscription CSV data
 */
export function validateSubscriptionCSV(
  rows: Record<string, string>[]
): ValidationResult<SubscriptionCSVRow> {
  const valid: SubscriptionCSVRow[] = [];
  const errors: ValidationError[] = [];

  rows.forEach((row, index) => {
    const rowNum = index + 1;

    // Validate required fields
    if (!row.appName?.trim()) {
      errors.push({
        row: rowNum,
        field: "appName",
        message: `Row ${rowNum}: App name is required`,
      });
      return;
    }

    if (!row.planName?.trim()) {
      errors.push({
        row: rowNum,
        field: "planName",
        message: `Row ${rowNum}: Plan name is required`,
      });
      return;
    }

    if (!row.billingCycle?.trim()) {
      errors.push({
        row: rowNum,
        field: "billingCycle",
        message: `Row ${rowNum}: Billing cycle is required`,
      });
      return;
    }

    // Validate billing cycle
    const billingCycle = row.billingCycle.trim().toUpperCase();
    if (
      !VALID_BILLING_CYCLES.includes(
        billingCycle as (typeof VALID_BILLING_CYCLES)[number]
      )
    ) {
      errors.push({
        row: rowNum,
        field: "billingCycle",
        message: `Row ${rowNum}: Invalid billing cycle (${billingCycle}). Allowed values: ${VALID_BILLING_CYCLES.join(", ")}`,
      });
      return;
    }

    // Validate price (optional)
    if (row.price?.trim()) {
      const price = parseFloat(row.price.trim());
      if (isNaN(price) || price < 0) {
        errors.push({
          row: rowNum,
          field: "price",
          message: `Row ${rowNum}: Price must be a valid number`,
        });
        return;
      }
    }

    // Validate renewal date (optional)
    if (row.renewalDate?.trim()) {
      const date = new Date(row.renewalDate.trim());
      if (isNaN(date.getTime())) {
        errors.push({
          row: rowNum,
          field: "renewalDate",
          message: `Row ${rowNum}: Invalid date format (YYYY-MM-DD)`,
        });
        return;
      }
    }

    valid.push({
      appName: row.appName.trim(),
      planName: row.planName.trim(),
      billingCycle: billingCycle,
      price: row.price?.trim() || undefined,
      renewalDate: row.renewalDate?.trim() || undefined,
      seats: row.seats?.trim() || undefined,
    });
  });

  return { valid, errors };
}

/**
 * Validate an email address
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate user CSV data
 */
export function validateUserCSV(
  rows: Record<string, string>[]
): ValidationResult<UserCSVRow> {
  const valid: UserCSVRow[] = [];
  const errors: ValidationError[] = [];
  const seenEmails = new Set<string>();

  rows.forEach((row, index) => {
    const rowNum = index + 1;

    // Email is required
    const email = row.email?.trim().toLowerCase();
    if (!email) {
      errors.push({
        row: rowNum,
        field: "email",
        message: `Row ${rowNum}: Email is required`,
      });
      return;
    }

    // Validate email format
    if (!isValidEmail(email)) {
      errors.push({
        row: rowNum,
        field: "email",
        message: `Row ${rowNum}: Invalid email format`,
      });
      return;
    }

    // Check for duplicate emails
    if (seenEmails.has(email)) {
      errors.push({
        row: rowNum,
        field: "email",
        message: `Row ${rowNum}: Duplicate email (${email})`,
      });
      return;
    }

    // Role is required
    if (!row.role?.trim()) {
      errors.push({
        row: rowNum,
        field: "role",
        message: `Row ${rowNum}: Role is required`,
      });
      return;
    }

    // Validate role
    const role = row.role.trim().toUpperCase();
    if (!VALID_USER_ROLES.includes(role as (typeof VALID_USER_ROLES)[number])) {
      errors.push({
        row: rowNum,
        field: "role",
        message: `Row ${rowNum}: Invalid role (${role}). Allowed values: ${VALID_USER_ROLES.join(", ")}`,
      });
      return;
    }

    // Track email for duplicate checks
    seenEmails.add(email);

    valid.push({
      email: email,
      name: row.name?.trim() || undefined,
      role: role,
      department: row.department?.trim() || undefined,
      jobTitle: row.jobTitle?.trim() || undefined,
      employeeId: row.employeeId?.trim() || undefined,
    });
  });

  return { valid, errors };
}
