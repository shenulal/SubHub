// scripts/seed-smoke.ts
// Seeds a QA organisation with admin / approver / member / viewer users and a few
// subscriptions so the Playwright smoke suite (tests/e2e) can run against a
// local database. Idempotent. Run: npx tsx scripts/seed-smoke.ts
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { ensureOrganizationDefaults } from "../src/lib/masters/organization-defaults";
import { ensurePermissionCatalog } from "../src/lib/rbac/service";

export const SMOKE = {
  orgName: "SubHub QA",
  domain: "subhub-qa.test",
  admin: {
    email: "qa-admin@subhub-qa.test",
    username: "qa.admin",
    name: "QA Admin",
    role: "ADMIN" as const,
  },
  approver: {
    email: "qa-approver@subhub-qa.test",
    username: "qa.approver",
    name: "QA Approver",
    role: "APPROVER" as const,
  },
  member: {
    email: "qa-member@subhub-qa.test",
    username: "qa.member",
    name: "QA Member",
    role: "MEMBER" as const,
  },
  viewer: {
    email: "qa-viewer@subhub-qa.test",
    username: "qa.viewer",
    name: "QA Viewer",
    role: "VIEWER" as const,
  },
};

const prisma = new PrismaClient();

/**
 * Password for the QA users, from SEED_QA_PASSWORD (never hard-coded).
 * Unset: users are seeded without a password change and a warning is shown.
 */
async function qaPasswordData() {
  const password = process.env.SEED_QA_PASSWORD;
  if (!password) {
    console.warn(
      "[seed-smoke] SEED_QA_PASSWORD is not set — QA users keep their current password (none on a fresh database)"
    );
    return {};
  }
  return {
    passwordHash: await hashPassword(password),
    passwordChangedAt: new Date(),
    passwordHistory: [],
    mustChangePassword: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
    loginOtpEnabled: false,
  };
}

export async function seedSmoke() {
  await ensurePermissionCatalog(prisma);
  const org = await prisma.organization.upsert({
    where: { domain: SMOKE.domain },
    update: {},
    create: { name: SMOKE.orgName, domain: SMOKE.domain },
  });
  await ensureOrganizationDefaults(org.id, { db: prisma, countryCode: "AE" });

  const passwordData = await qaPasswordData();
  const users: Record<string, { id: string; email: string }> = {};
  for (const key of ["admin", "approver", "member", "viewer"] as const) {
    const u = SMOKE[key];
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        organizationId: org.id,
        role: u.role,
        status: "ACTIVE",
        emailVerified: new Date(),
        username: u.username,
        ...passwordData,
      },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        status: "ACTIVE",
        emailVerified: new Date(),
        organizationId: org.id,
        username: u.username,
        ...passwordData,
      },
      select: { id: true, email: true },
    });
    users[key] = user;
  }
  await prisma.user.update({
    where: { id: users.member.id },
    data: { managerId: users.approver.id },
  });

  const team = await prisma.team.upsert({
    where: {
      organizationId_externalId: {
        organizationId: org.id,
        externalId: "qa-eng",
      },
    },
    update: { approverId: users.approver.id },
    create: {
      organizationId: org.id,
      name: "Engineering",
      externalId: "qa-eng",
      approverId: users.approver.id,
    },
  });

  const category = await prisma.category.findFirst({
    where: { organizationId: org.id, slug: "project-management" },
  });
  const samples = [
    {
      name: "Slack",
      amount: 420,
      currency: "USD",
      cycle: "MONTHLY" as const,
      days: 12,
    },
    {
      name: "Figma",
      amount: 1500,
      currency: "AED",
      cycle: "YEARLY" as const,
      days: 40,
    },
    {
      name: "Notion",
      amount: 96,
      currency: "USD",
      cycle: "MONTHLY" as const,
      days: 3,
      trial: true,
    },
  ];
  for (const s of samples) {
    const app = await prisma.app.upsert({
      where: { organizationId_name: { organizationId: org.id, name: s.name } },
      update: {},
      create: {
        organizationId: org.id,
        name: s.name,
        source: "MANUAL",
        categoryId: category?.id,
      },
    });
    const renewalDate = new Date(Date.now() + s.days * 86400000);
    await prisma.subscription.upsert({
      where: {
        appId_organizationId: { appId: app.id, organizationId: org.id },
      },
      update: {},
      create: {
        appId: app.id,
        organizationId: org.id,
        teamId: team.id,
        amount: s.amount,
        currency: s.currency,
        billingCycle: s.cycle,
        startDate: new Date(Date.now() - 30 * 86400000),
        renewalDate,
        categoryId: category?.id,
        ownerId: users.admin.id,
        isTrial: Boolean(s.trial),
        trialEndsAt: s.trial ? renewalDate : null,
        reminderLeadDays: [7, 3, 1],
      },
    });
  }
  return { organizationId: org.id, users, teamId: team.id };
}

/** Insert a one-time code so the smoke suite can sign in without email. */
export async function createOtp(email: string, code = "246810") {
  await prisma.otpToken.deleteMany({ where: { email } });
  await prisma.otpToken.create({
    data: { email, code, expires: new Date(Date.now() + 3600_000) },
  });
  return code;
}

if (require.main === module) {
  seedSmoke()
    .then((r) => console.log("[seed-smoke] ok", r.organizationId))
    .catch((e) => {
      console.error("[seed-smoke] failed", e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
