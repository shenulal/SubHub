// src/actions/bulk-import.ts
"use server";

import { auth } from "@/lib/auth";
import {
  parseCSV,
  validateAppCSV,
  validateSubscriptionCSV,
  validateUserCSV,
  type ValidationError,
} from "@/lib/csv";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { can } from "@/lib/rbac/service";
import type { ActionState } from "@/types";
import type { BillingCycle, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

export interface BulkImportResult {
  created: number;
  errors: ValidationError[];
}

// Bulk import apps
async function _bulkImportApps(
  csvContent: string
): Promise<ActionState<BulkImportResult>> {
  try {
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        message: "Authentication required",
      };
    }

    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }

    // Check admin permission
    if (!(await can("apps:manage"))) {
      return {
        success: false,
        message: "Only admins can bulk import",
      };
    }

    // Parse the CSV
    const rows = parseCSV(csvContent);

    if (rows.length === 0) {
      return {
        success: false,
        message: "There is no data to import",
      };
    }

    // Validate
    const categories = await prisma.category.findMany({
      where: {
        organizationId: session.user.organizationId!,
        isArchived: false,
      },
      select: { id: true, name: true, slug: true },
    });
    const { valid, errors } = validateAppCSV(rows, categories);

    if (errors.length > 0 && valid.length === 0) {
      return {
        success: false,
        message: "There is no valid data",
        data: { created: 0, errors },
      };
    }

    // Create apps
    const result = await prisma.app.createMany({
      data: valid.map((row) => ({
        name: row.name,
        category: row.category,
        categoryId: row.categoryId ?? null,
        customWebsite: row.website || null,
        notes: row.vendor
          ? `${row.vendor}${row.description ? ` - ${row.description}` : ""}`
          : row.description || null,
        organizationId: session.user.organizationId!,
        ownerId: session.user.id,
        source: "CSV_IMPORT",
        status: "ACTIVE",
      })),
      skipDuplicates: true,
    });

    revalidatePath("/apps");

    return {
      success: true,
      message: `Imported ${result.count} apps`,
      data: { created: result.count, errors },
    };
  } catch (error) {
    logger.error({ err: error }, "App bulk import error");
    return {
      success: false,
      message: "An error occurred while bulk importing apps",
    };
  }
}
export const bulkImportApps = withLogging("bulkImportApps", _bulkImportApps);

// Bulk import subscriptions
async function _bulkImportSubscriptions(
  csvContent: string
): Promise<ActionState<BulkImportResult>> {
  try {
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        message: "Authentication required",
      };
    }

    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }

    // Check admin permission
    if (!(await can("subscriptions:bulk"))) {
      return {
        success: false,
        message: "Only admins can bulk import",
      };
    }

    // Parse the CSV
    const rows = parseCSV(csvContent);

    if (rows.length === 0) {
      return {
        success: false,
        message: "There is no data to import",
      };
    }

    // Validate
    const { valid, errors } = validateSubscriptionCSV(rows);

    if (errors.length > 0 && valid.length === 0) {
      return {
        success: false,
        message: "There is no valid data",
        data: { created: 0, errors },
      };
    }

    // Look up app IDs by app name
    const appNames = [...new Set(valid.map((row) => row.appName))];
    const apps = await prisma.app.findMany({
      where: {
        organizationId: session.user.organizationId,
        name: { in: appNames },
      },
      select: { id: true, name: true },
    });

    const appNameToId = new Map(apps.map((app) => [app.name, app.id]));

    // Check for apps that do not exist
    const subscriptionData: Array<{
      appId: string;
      billingCycle: BillingCycle;
      amount: number;
      renewalDate: Date | null;
      startDate: Date;
      totalLicenses: number | null;
      notes: string | null;
      organizationId: string;
    }> = [];
    const notFoundErrors: ValidationError[] = [];

    valid.forEach((row, index) => {
      const appId = appNameToId.get(row.appName);
      if (!appId) {
        notFoundErrors.push({
          row: index + 1,
          field: "appName",
          message: `Row ${index + 1}: app "${row.appName}" not found`,
        });
        return;
      }

      subscriptionData.push({
        appId,
        billingCycle: row.billingCycle as BillingCycle,
        amount: row.price ? parseFloat(row.price) : 0,
        renewalDate: row.renewalDate ? new Date(row.renewalDate) : null,
        startDate: new Date(),
        totalLicenses: row.seats ? parseInt(row.seats, 10) : null,
        notes: row.planName ? `Plan: ${row.planName}` : null,
        organizationId: session.user.organizationId!,
      });
    });

    const allErrors = [...errors, ...notFoundErrors];

    if (subscriptionData.length === 0) {
      return {
        success: false,
        message: "There are no valid subscriptions to import",
        data: { created: 0, errors: allErrors },
      };
    }

    // Create subscriptions
    const result = await prisma.subscription.createMany({
      data: subscriptionData,
      skipDuplicates: true,
    });

    revalidatePath("/subscriptions");

    return {
      success: true,
      message: `Imported ${result.count} subscriptions`,
      data: { created: result.count, errors: allErrors },
    };
  } catch (error) {
    logger.error({ err: error }, "Subscription bulk import error");
    return {
      success: false,
      message: "An error occurred while bulk importing subscriptions",
    };
  }
}
export const bulkImportSubscriptions = withLogging(
  "bulkImportSubscriptions",
  _bulkImportSubscriptions
);

// Bulk import users
async function _bulkImportUsers(
  csvContent: string
): Promise<ActionState<BulkImportResult>> {
  try {
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        message: "Authentication required",
      };
    }

    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }

    // Check admin permission
    if (!(await can("members:manage"))) {
      return {
        success: false,
        message: "Only admins can bulk import",
      };
    }

    // Parse the CSV
    const rows = parseCSV(csvContent);

    if (rows.length === 0) {
      return {
        success: false,
        message: "There is no data to import",
      };
    }

    // Validate
    const { valid, errors } = validateUserCSV(rows);

    if (errors.length > 0 && valid.length === 0) {
      return {
        success: false,
        message: "There is no valid data",
        data: { created: 0, errors },
      };
    }

    // Fetch existing user emails
    const emails = valid.map((row) => row.email);
    const existingUsers = await prisma.user.findMany({
      where: {
        organizationId: session.user.organizationId,
        email: { in: emails },
      },
      select: { email: true },
    });

    const existingEmails = new Set(existingUsers.map((u) => u.email));

    // Filter out duplicate users
    const newUsers = valid.filter((row) => !existingEmails.has(row.email));
    const duplicateErrors: ValidationError[] = valid
      .filter((row) => existingEmails.has(row.email))
      .map((row, index) => ({
        row: index + 1,
        field: "email",
        message: `User already exists: ${row.email}`,
      }));

    const allErrors = [...errors, ...duplicateErrors];

    if (newUsers.length === 0) {
      return {
        success: allErrors.length === 0,
        message:
          allErrors.length === 0
            ? "There are no new users to import"
            : "There are no valid new users",
        data: { created: 0, errors: allErrors },
      };
    }

    // Create users
    const result = await prisma.user.createMany({
      data: newUsers.map((row) => ({
        email: row.email,
        name: row.name || null,
        role: row.role as UserRole,
        department: row.department || null,
        jobTitle: row.jobTitle || null,
        employeeId: row.employeeId || null,
        organizationId: session.user.organizationId!,
        status: "ACTIVE",
      })),
      skipDuplicates: true,
    });

    // Write the audit log
    await prisma.auditLog.create({
      data: {
        action: "BULK_IMPORT_USERS",
        entityType: "User",
        entityId: session.user.organizationId!,
        userId: session.user.id,
        organizationId: session.user.organizationId!,
        metadata: {
          totalRows: valid.length,
          createdCount: result.count,
          errorCount: allErrors.length,
          importedEmails: newUsers.map((u) => u.email),
        },
      },
    });

    revalidatePath("/users");
    revalidatePath("/settings/team");

    return {
      success: true,
      message: `Imported ${result.count} users`,
      data: { created: result.count, errors: allErrors },
    };
  } catch (error) {
    logger.error({ err: error }, "User bulk import error");
    return {
      success: false,
      message: "An error occurred while bulk importing users",
    };
  }
}
export const bulkImportUsers = withLogging("bulkImportUsers", _bulkImportUsers);

export interface ChunkImportResult {
  processed: number;
  skipped: number;
  errors: string[];
}

// Import a chunk of the user CSV (for progress uploads)
async function _importUsersChunk(
  csvChunk: string
): Promise<ActionState<ChunkImportResult>> {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, message: "Authentication required" };
    }

    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }

    if (!(await can("members:manage"))) {
      return { success: false, message: "Only admins can bulk import" };
    }

    const rows = parseCSV(csvChunk);

    if (rows.length === 0) {
      return {
        success: true,
        message: "No data to process",
        data: { processed: 0, skipped: 0, errors: [] },
      };
    }

    const { valid, errors } = validateUserCSV(rows);
    const errorMessages = errors.map((e) => e.message);

    if (valid.length === 0) {
      return {
        success: true,
        message: "No valid data",
        data: { processed: 0, skipped: 0, errors: errorMessages },
      };
    }

    // Fetch existing user emails (skip duplicates)
    const emails = valid.map((row) => row.email);
    const existingUsers = await prisma.user.findMany({
      where: {
        organizationId: session.user.organizationId,
        email: { in: emails },
      },
      select: { email: true },
    });

    const existingEmails = new Set(existingUsers.map((u) => u.email));
    const newUsers = valid.filter((row) => !existingEmails.has(row.email));
    const skipped = valid.length - newUsers.length;

    if (newUsers.length === 0) {
      return {
        success: true,
        message: "All rows skipped as duplicates",
        data: { processed: 0, skipped, errors: errorMessages },
      };
    }

    const result = await prisma.user.createMany({
      data: newUsers.map((row) => ({
        email: row.email,
        name: row.name || null,
        role: row.role as UserRole,
        department: row.department || null,
        jobTitle: row.jobTitle || null,
        employeeId: row.employeeId || null,
        organizationId: session.user.organizationId!,
        status: "ACTIVE",
      })),
      skipDuplicates: true,
    });

    revalidatePath("/users");
    revalidatePath("/settings/team");

    return {
      success: true,
      message: `Imported ${result.count} users`,
      data: { processed: result.count, skipped, errors: errorMessages },
    };
  } catch (error) {
    logger.error({ err: error }, "User chunk import error");
    return {
      success: false,
      message: "An error occurred while processing the chunk",
    };
  }
}
export const importUsersChunk = withLogging(
  "importUsersChunk",
  _importUsersChunk
);
