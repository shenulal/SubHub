// src/components/devices/devices-page.constants.ts
import type { DeviceStatus } from "@prisma/client";

export const statusBadgeVariants: Record<DeviceStatus, string> = {
  ONLINE: "tonal-success border-transparent",
  OFFLINE: "tonal-neutral border-transparent",
  PENDING: "tonal-warning border-transparent",
  RETIRED: "tonal-error border-transparent",
};
