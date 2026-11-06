// scripts/create-super-admin.ts
/**
 * Bootstrap (or reset) a platform super admin for the Control Panel.
 *
 *   npm run platform:create-super-admin
 *   npm run platform:create-super-admin -- --email ops@example.com --name "Ops" --password '…'
 *
 * Values come from flags or the environment: SUPER_ADMIN_EMAIL,
 * SUPER_ADMIN_PASSWORD, SUPER_ADMIN_NAME. Nothing is hard-coded and the
 * password is never printed. Re-running with the same email resets the name and
 * password and re-enables the account. An email that belongs to a tenant user is
 * refused.
 *
 * `--create-only` (used by the Docker migrate job on every start) creates the
 * account when it is missing and leaves an existing one untouched, so a
 * password changed in the Control Panel is never reset by a container restart.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import {
  checkPasswordPolicy,
  type PasswordPolicy,
} from "../src/lib/auth/password-policy";
import {
  SuperAdminError,
  upsertSuperAdmin,
} from "../src/lib/platform/super-admins";
import {
  SETTING_DEFINITIONS,
  type SettingKey,
} from "../src/lib/settings/registry";

const prisma = new PrismaClient();

function flag(name: string): string | undefined {
  const args = process.argv.slice(2);
  const eq = args.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

/** Platform (system) value of a setting: stored override or registry default. */
async function systemValue<T>(key: SettingKey): Promise<T> {
  const def = SETTING_DEFINITIONS[key];
  const row = await prisma.systemSetting.findUnique({
    where: { key },
    select: { value: true },
  });
  const parsed = def.schema.safeParse(row?.value);
  return (parsed.success ? parsed.data : def.defaultValue) as T;
}

/** The platform password policy (Settings > Security, system scope). */
async function platformPasswordPolicy(): Promise<PasswordPolicy> {
  return {
    minLength: await systemValue<number>("security.passwordMinLength"),
    requireUppercase: await systemValue<boolean>(
      "security.passwordRequireUppercase"
    ),
    requireLowercase: await systemValue<boolean>(
      "security.passwordRequireLowercase"
    ),
    requireNumber: await systemValue<boolean>("security.passwordRequireNumber"),
    requireSymbol: await systemValue<boolean>("security.passwordRequireSymbol"),
    historyCount: 0,
  };
}

function fail(message: string): never {
  console.error(`[platform] ${message}`);
  process.exit(1);
}

async function main() {
  const email = flag("email") ?? process.env.SUPER_ADMIN_EMAIL;
  const password = flag("password") ?? process.env.SUPER_ADMIN_PASSWORD;
  const name =
    flag("name") ?? process.env.SUPER_ADMIN_NAME ?? "Platform administrator";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail("Set SUPER_ADMIN_EMAIL (or --email) to a valid email address.");
  }
  if (!password) fail("Set SUPER_ADMIN_PASSWORD (or --password).");
  if (process.argv.slice(2).includes("--create-only")) {
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    if (existing) {
      console.log(
        `[platform] Super admin ${email} already exists; left unchanged (--create-only).`
      );
      return;
    }
  }
  const issues = checkPasswordPolicy(password, await platformPasswordPolicy());
  if (issues.length > 0) fail(issues[0]);

  const result = await upsertSuperAdmin(prisma, {
    email,
    name,
    passwordHash: await hashPassword(password),
  });
  await prisma.platformAuditLog.create({
    data: {
      actorId: null,
      action: result.created ? "BOOTSTRAP_SUPER_ADMIN" : "RESET_SUPER_ADMIN",
      entityType: "User",
      entityId: result.id,
      changes: { email: result.email, name },
      metadata: { source: "cli" },
    },
  });
  console.log(
    `[platform] Super admin ${result.created ? "created" : "updated"}: ${result.email} (${result.id}). Sign in at /super-admin/login`
  );
}

main()
  .catch((error) => {
    if (error instanceof SuperAdminError) fail(error.message);
    console.error("[platform] Failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
