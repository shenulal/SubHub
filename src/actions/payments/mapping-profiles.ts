// src/actions/payments/mapping-profiles.ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { can } from "@/lib/rbac/service";
import type { ActionState } from "@/types";
import { revalidatePath } from "next/cache";

// ============================================================
// Types
// ============================================================

export interface MappingProfileData {
  id: string;
  name: string;
  sourceFormat: string;
  fieldMappings: Record<string, string>;
  doubleEntry: {
    enabled: boolean;
    debitAccountColumn?: string;
    creditAccountColumn?: string;
    expensePrefix?: string;
  } | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Read
// ============================================================

async function _getMappingProfiles(): Promise<
  ActionState<MappingProfileData[]>
> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { success: false, message: "Authentication required" };
  }
  if (!(await can("payments:read"))) {
    return {
      success: false,
      message: "You do not have permission to perform this action",
    };
  }

  const profiles = await prisma.csvMappingProfile.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  return {
    success: true,
    data: profiles.map((p) => ({
      id: p.id,
      name: p.name,
      sourceFormat: p.sourceFormat,
      fieldMappings: p.fieldMappings as Record<string, string>,
      doubleEntry: p.doubleEntry as MappingProfileData["doubleEntry"],
      isDefault: p.isDefault,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
  };
}

export const getMappingProfiles = withLogging(
  "getMappingProfiles",
  _getMappingProfiles
);

// ============================================================
// Create
// ============================================================

async function _createMappingProfile(
  _prevState: ActionState<{ id: string }>,
  formData: FormData
): Promise<ActionState<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { success: false, message: "Authentication required" };
  }
  if (!(await can("payments:manage"))) {
    return {
      success: false,
      message: "You do not have permission to perform this action",
    };
  }

  const name = formData.get("name") as string;
  const sourceFormat = (formData.get("sourceFormat") as string) || "CUSTOM";
  const fieldMappingsJson = formData.get("fieldMappings") as string;
  const doubleEntryJson = formData.get("doubleEntry") as string | null;
  const isDefault = formData.get("isDefault") === "true";

  if (!name || !fieldMappingsJson) {
    return { success: false, message: "Profile name and mapping are required" };
  }

  let fieldMappings: Record<string, string>;
  let doubleEntry: Record<string, unknown> | null = null;

  try {
    fieldMappings = JSON.parse(fieldMappingsJson);
    if (doubleEntryJson) {
      doubleEntry = JSON.parse(doubleEntryJson);
    }
  } catch {
    return { success: false, message: "Invalid mapping format" };
  }

  const profile = await prisma.$transaction(async (tx) => {
    // When setting isDefault, clear the existing default
    if (isDefault) {
      await tx.csvMappingProfile.updateMany({
        where: {
          organizationId: session.user!.organizationId!,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    return tx.csvMappingProfile.create({
      data: {
        organizationId: session.user!.organizationId!,
        name,
        sourceFormat,
        fieldMappings,
        ...(doubleEntry ? { doubleEntry: doubleEntry as object } : {}),
        isDefault,
      },
    });
  });

  revalidatePath("/settings/import");
  return {
    success: true,
    message: `Mapping profile "${name}" saved`,
    data: { id: profile.id },
  };
}

export const createMappingProfile = withLogging(
  "createMappingProfile",
  _createMappingProfile
);

// ============================================================
// Update
// ============================================================

async function _updateMappingProfile(
  _prevState: ActionState<void>,
  formData: FormData
): Promise<ActionState<void>> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { success: false, message: "Authentication required" };
  }
  if (!(await can("payments:manage"))) {
    return {
      success: false,
      message: "You do not have permission to perform this action",
    };
  }

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const fieldMappingsJson = formData.get("fieldMappings") as string;
  const doubleEntryJson = formData.get("doubleEntry") as string | null;
  const isDefault = formData.get("isDefault") === "true";

  if (!id) {
    return { success: false, message: "Profile ID is required" };
  }

  // Verify ownership
  const existing = await prisma.csvMappingProfile.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });

  if (!existing) {
    return { success: false, message: "Profile not found" };
  }

  const updateData: Record<string, unknown> = {};
  if (name) updateData.name = name;
  if (fieldMappingsJson) {
    try {
      updateData.fieldMappings = JSON.parse(fieldMappingsJson);
    } catch {
      return {
        success: false,
        message: "Invalid mapping format",
      };
    }
  }
  if (doubleEntryJson) {
    try {
      updateData.doubleEntry = JSON.parse(doubleEntryJson);
    } catch {
      return {
        success: false,
        message: "Invalid double-entry settings format",
      };
    }
  }

  if (isDefault) {
    updateData.isDefault = true;
  }

  await prisma.$transaction(async (tx) => {
    // When setting isDefault, clear the existing default
    if (isDefault) {
      await tx.csvMappingProfile.updateMany({
        where: {
          organizationId: session.user!.organizationId!,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    await tx.csvMappingProfile.update({
      where: { id },
      data: updateData,
    });
  });

  revalidatePath("/settings/import");
  return { success: true, message: "Mapping profile updated" };
}

export const updateMappingProfile = withLogging(
  "updateMappingProfile",
  _updateMappingProfile
);

// ============================================================
// Delete
// ============================================================

async function _deleteMappingProfile(
  _prevState: ActionState<void>,
  formData: FormData
): Promise<ActionState<void>> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { success: false, message: "Authentication required" };
  }
  if (!(await can("payments:manage"))) {
    return {
      success: false,
      message: "You do not have permission to perform this action",
    };
  }

  const id = formData.get("id") as string;
  if (!id) {
    return { success: false, message: "Profile ID is required" };
  }

  // Verify ownership
  const existing = await prisma.csvMappingProfile.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });

  if (!existing) {
    return { success: false, message: "Profile not found" };
  }

  await prisma.csvMappingProfile.delete({ where: { id } });

  revalidatePath("/settings/import");
  return { success: true, message: "Mapping profile deleted" };
}

export const deleteMappingProfile = withLogging(
  "deleteMappingProfile",
  _deleteMappingProfile
);
