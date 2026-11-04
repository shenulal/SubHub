// scripts/backfill-organization-defaults.ts
// Seeds roles, categories, payment methods, billing cycles and tax rate for every
// existing organisation. Run after deploying the SubHub migrations:
//   npx tsx scripts/backfill-organization-defaults.ts
import { PrismaClient } from "@prisma/client";
import { ensureOrganizationDefaults } from "../src/lib/masters/organization-defaults";
import { ensurePermissionCatalog } from "../src/lib/rbac/service";

const prisma = new PrismaClient();

async function main() {
  await ensurePermissionCatalog(prisma);
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true },
  });
  for (const org of orgs) {
    await ensureOrganizationDefaults(org.id, { db: prisma });
    console.log(`[backfill] ${org.name} (${org.id}) ok`);
  }
  console.log(`[backfill] ${orgs.length} organisation(s) processed`);
}

main()
  .catch((error) => {
    console.error("[backfill] failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
