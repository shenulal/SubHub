// prisma/seed.ts
// Global master data seed: currencies, countries, permission catalogue.
// Run: npm run db:seed   (also safe to re-run in production — all upserts)
import { PrismaClient } from "@prisma/client";
import { seedCountries } from "./seeds/countries";
import { seedCurrencies } from "./seeds/currencies";
import { seedPermissionCatalog } from "./seeds/permissions";
import { seedSaasCatalog } from "./seeds/saas-catalog";

const prisma = new PrismaClient();

async function main() {
  const currencies = await seedCurrencies(prisma);
  const countries = await seedCountries(prisma);
  const permissions = await seedPermissionCatalog(prisma);
  const catalog = await seedSaasCatalog(prisma);
  console.log(
    `[seed] currencies=${currencies} countries=${countries} permissions=${permissions} catalog=${catalog}`
  );
}

main()
  .catch((error) => {
    console.error("[seed] failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
