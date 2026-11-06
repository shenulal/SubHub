// src/lib/platform/platform-user.ts
/** Per-request lookup of the signed-in user's platform identity (server-only). */
import { prisma } from "@/lib/db";
import { cache } from "react";

export const loadPlatformUser = cache(async (userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      organizationId: true,
    },
  })
);
