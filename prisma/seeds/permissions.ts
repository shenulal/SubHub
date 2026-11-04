// prisma/seeds/permissions.ts
import type { PrismaClient } from "@prisma/client";
import { PERMISSIONS } from "../../src/lib/rbac/permissions";

export async function seedPermissionCatalog(
  prisma: PrismaClient
): Promise<number> {
  for (const def of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: def.key },
      create: { ...def },
      update: {
        resource: def.resource,
        action: def.action,
        group: def.group,
        description: def.description,
      },
    });
  }
  return PERMISSIONS.length;
}
