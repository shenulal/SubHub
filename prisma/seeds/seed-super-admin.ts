// prisma/seeds/seed-super-admin.ts
/**
 * Script that creates the initial Super Admin account
 *
 * Usage:
 *   npm run seed:super-admin
 *
 * Environment variables:
 *   SUPER_ADMIN_EMAIL    - Super Admin email (required)
 *   SUPER_ADMIN_PASSWORD - Super Admin password (optional; without it only email OTP is used)
 */

import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email) {
    console.error("❌ The SUPER_ADMIN_EMAIL environment variable is not set.");
    process.exit(1);
  }

  console.log(`🔧 Creating Super Admin account: ${email}`);

  // Check for an existing account
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    if (existingUser.role === "SUPER_ADMIN") {
      console.log("✅ The Super Admin account already exists.");
      return;
    }
    // Upgrade the existing account to SUPER_ADMIN
    await prisma.user.update({
      where: { email },
      data: {
        role: "SUPER_ADMIN",
        organizationId: null,
        emailVerified: new Date(),
      },
    });
    console.log("✅ Upgraded the existing account to Super Admin.");
    return;
  }

  // Hash the password
  let passwordHash: string | undefined;
  if (password) {
    passwordHash = await bcrypt.hash(password, 12);
  }

  // Create the Super Admin account
  const superAdmin = await prisma.user.create({
    data: {
      email,
      name: "Super Admin",
      role: "SUPER_ADMIN",
      organizationId: null,
      emailVerified: new Date(),
      status: "ACTIVE",
      passwordHash: passwordHash ?? null,
    },
  });

  console.log(`✅ Super Admin account created!`);
  console.log(`   ID: ${superAdmin.id}`);
  console.log(`   Email: ${superAdmin.email}`);
  console.log(`   Role: ${superAdmin.role}`);
  console.log(`   Password: ${password ? "set" : "not set (OTP only)"}`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
