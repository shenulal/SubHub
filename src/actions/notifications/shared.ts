// src/actions/notifications/shared.ts
/**
 * Helpers shared by the notification server actions (not a server-action file).
 */
import { logger } from "@/lib/logger";
import { isForbiddenError } from "@/lib/rbac/service";
import type { ActionState } from "@/types";
import { ZodError } from "zod";

export const FORBIDDEN_MESSAGE = "You do not have permission to do this";
export const INVALID_INPUT_MESSAGE = "Invalid input";
export const UNEXPECTED_MESSAGE = "Something went wrong. Please try again.";

export function toActionError<T = null>(
  error: unknown,
  context: string
): ActionState<T> {
  if (isForbiddenError(error)) {
    return {
      success: false,
      error: FORBIDDEN_MESSAGE,
      message: FORBIDDEN_MESSAGE,
    };
  }
  if (error instanceof ZodError) {
    return {
      success: false,
      error: INVALID_INPUT_MESSAGE,
      message: INVALID_INPUT_MESSAGE,
      errors: error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  logger.error({ err: error }, `[notifications] ${context} failed`);
  return {
    success: false,
    error: UNEXPECTED_MESSAGE,
    message: UNEXPECTED_MESSAGE,
  };
}
