// src/lib/services/notification/device-tokens.ts
/**
 * Device token registry for push readiness (mobile / web clients).
 */
import { prisma } from "@/lib/db";
import type { RegisterDeviceTokenInput } from "@/lib/validations/notifications";
import type { DeviceTokenItem } from "@/types/notification";
import type { DeviceToken } from "@prisma/client";

function toItem(row: DeviceToken): DeviceTokenItem {
  return {
    id: row.id,
    platform: row.platform,
    deviceName: row.deviceName,
    lastSeenAt: row.lastSeenAt.toISOString(),
  };
}

/** Upsert by token; a token moving between users is re-assigned to the caller. */
export async function registerDeviceToken(
  userId: string,
  input: RegisterDeviceTokenInput,
  now: Date = new Date()
): Promise<DeviceTokenItem> {
  const row = await prisma.deviceToken.upsert({
    where: { token: input.token },
    create: {
      userId,
      token: input.token,
      platform: input.platform,
      deviceName: input.deviceName ?? null,
      lastSeenAt: now,
    },
    update: {
      userId,
      platform: input.platform,
      deviceName: input.deviceName ?? undefined,
      lastSeenAt: now,
    },
  });
  return toItem(row);
}

export async function removeDeviceToken(
  userId: string,
  selector: { token?: string; id?: string }
): Promise<number> {
  const res = await prisma.deviceToken.deleteMany({
    where: {
      userId,
      ...(selector.token ? { token: selector.token } : {}),
      ...(selector.id ? { id: selector.id } : {}),
    },
  });
  return res.count;
}

export async function listDeviceTokens(
  userId: string
): Promise<DeviceTokenItem[]> {
  const rows = await prisma.deviceToken.findMany({
    where: { userId },
    orderBy: { lastSeenAt: "desc" },
  });
  return rows.map(toItem);
}
