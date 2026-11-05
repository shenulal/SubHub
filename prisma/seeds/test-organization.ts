// prisma/seeds/test-organization.ts
// Seed data for the fictional TestCorp organisation

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedTestOrganization() {
  console.log("🏢 Creating TestCorp organisation seed data...");

  // Create the organisation (skip if it already exists)
  const org = await prisma.organization.upsert({
    where: { domain: "testcorp.com" },
    update: {},
    create: {
      name: "TestCorp Inc.",
      domain: "testcorp.com",
      plan: "ENTERPRISE",
    },
  });

  console.log(`✅ Organisation created: ${org.name} (${org.id})`);

  // Create the admin
  const admin = await prisma.user.upsert({
    where: {
      email_organizationId: {
        email: "admin@testcorp.com",
        organizationId: org.id,
      },
    },
    update: {},
    create: {
      email: "admin@testcorp.com",
      name: "Admin User",
      role: "ADMIN",
      department: "IT",
      jobTitle: "System Administrator",
      employeeId: "EMP001",
      organizationId: org.id,
      status: "ACTIVE",
    },
  });

  console.log(`✅ Admin created: ${admin.email}`);

  // Create teams
  const teams = ["Engineering", "Marketing", "HR", "Finance"];
  for (const teamName of teams) {
    await prisma.team.upsert({
      where: {
        name_organizationId: {
          name: teamName,
          organizationId: org.id,
        },
      },
      update: {},
      create: {
        name: teamName,
        organizationId: org.id,
        managerId: admin.id,
      },
    });
    console.log(`✅ Team created: ${teamName}`);
  }

  console.log("🎉 TestCorp seed data created!");
  console.log(`📋 Organisation ID: ${org.id}`);
  console.log(`📧 Admin: admin@testcorp.com`);
  console.log(`📁 Test CSV: public/templates/test-users-sample.csv (25 users)`);
}

// When run standalone
if (require.main === module) {
  seedTestOrganization()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
