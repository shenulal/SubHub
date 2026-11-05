// src/actions/profile.ts
"use server";

import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import type { ActionState } from "@/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  // Commented out: job title, department and avatar fields
  // title: z
  //   .string()
  //   .max(50, "Job title must be 50 characters or fewer")
  //   .optional()
  //   .or(z.literal("")),
  // department: z
  //   .string()
  //   .max(50, "Department must be 50 characters or fewer")
  //   .optional()
  //   .or(z.literal("")),
  // avatarUrl: z
  //   .string()
  //   .url("Please enter a valid URL")
  //   .optional()
  //   .or(z.literal("")),
});

async function _updateProfile(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireAuth();

  const result = profileSchema.safeParse({
    name: formData.get("name"),
    // Commented out: job title, department and avatar fields
    // title: formData.get("title"),
    // department: formData.get("department"),
    // avatarUrl: formData.get("avatarUrl"),
  });

  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors as Record<string, string[]>,
      message: "Please check your input",
    };
  }

  const { name } = result.data;
  // Commented out: job title, department and avatar fields
  // const { name, title, department, avatarUrl } = result.data;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name,
      // Commented out: job title, department and avatar fields
      // jobTitle: title || null,
      // department: department || null,
      // avatarUrl: avatarUrl || null,
    },
  });

  revalidatePath("/settings");

  return { success: true, message: "Profile updated" };
}
export const updateProfile = withLogging("updateProfile", _updateProfile);
