// src/actions/users.types.ts
/**
 * User types and schemas
 */

import type { UserFilterOptions, UserSortOptions } from "@/types/user";
import { z } from "zod";

/**
 * User list query parameters
 */
export interface GetUsersParams {
  filter?: UserFilterOptions;
  sort?: UserSortOptions;
  page?: number;
  limit?: number;
}

/**
 * User update schema
 */
export const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  role: z.enum(["ADMIN", "APPROVER", "MEMBER", "VIEWER"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "TERMINATED"]).optional(),
  department: z.string().optional(),
  jobTitle: z.string().optional(),
  employeeId: z.string().optional(),
});
