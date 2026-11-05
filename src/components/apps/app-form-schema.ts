import { AppStatus } from "@prisma/client";
import { z } from "zod";

// Validates a URL or a relative path (starting with /)
const isValidUrlOrPath = (val: string) => {
  if (!val || val === "") return true;
  if (val.startsWith("/")) return true; // allow relative paths
  try {
    new URL(val);
    return true;
  } catch {
    return false;
  }
};

export const appFormSchema = z.object({
  name: z
    .string()
    .min(2, "App name must be at least 2 characters")
    .max(100, "App name must be 100 characters or fewer"),
  status: z.nativeEnum(AppStatus).optional(),
  category: z.string().optional(),
  customLogoUrl: z
    .string()
    .refine(isValidUrlOrPath, { message: "Please enter a valid URL" })
    .optional(),
  customWebsite: z
    .string()
    .url("Please enter a valid URL")
    .or(z.literal(""))
    .optional(),
  notes: z
    .string()
    .max(1000, "Notes must be 1000 characters or fewer")
    .optional(),
  tags: z.string().optional(),
  ownerId: z.string().optional(),
  catalogId: z.string().optional(),
  teamIds: z.array(z.string()).optional(),
});

export type AppFormValues = z.infer<typeof appFormSchema>;
