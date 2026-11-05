import type { AppStatus } from "@prisma/client";

/** Materio tonal badge classes per app status (paired with Badge variant="outline"). */
export const APP_STATUS_TONE: Record<AppStatus, string> = {
  ACTIVE: "border-transparent bg-success/15 text-success",
  INACTIVE: "border-transparent bg-neutral/15 text-neutral",
  PENDING_REVIEW: "border-transparent bg-warning/15 text-warning",
  BLOCKED: "border-transparent bg-error/15 text-error",
};
