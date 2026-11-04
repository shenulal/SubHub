// src/lib/masters/organization-defaults.ts
/**
 * Seeds the per-organisation master data a workspace needs to function:
 * system roles, default two-level categories, payment methods, billing-cycle
 * configuration and a tax rate derived from the organisation country.
 *
 * Called inside `createOrganization` and by `scripts/backfill-organization-defaults.ts`.
 * Idempotent: existing rows are never overwritten.
 */
import { prisma } from "@/lib/db";
import { ensureOrganizationRoles } from "@/lib/rbac/service";
import { getSetting } from "@/lib/settings/service";
import type { BillingCycle, PaymentMethodKind, Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

export interface DefaultCategoryTree {
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  children: { name: string; slug: string }[];
}

export const DEFAULT_CATEGORY_TREE: DefaultCategoryTree[] = [
  {
    name: "Software",
    slug: "software",
    icon: "laptop",
    color: "#6366f1",
    children: [
      { name: "Project Management", slug: "project-management" },
      { name: "Communication & Collaboration", slug: "communication" },
      { name: "Design & Creative", slug: "design" },
      { name: "Development Tools", slug: "development-tools" },
      { name: "Productivity & Office", slug: "productivity" },
      { name: "CRM & Sales", slug: "crm-sales" },
      { name: "Marketing", slug: "marketing" },
      { name: "HR & Payroll", slug: "hr-payroll" },
      { name: "Finance & Accounting", slug: "finance-accounting" },
      { name: "Security & Identity", slug: "security" },
      { name: "Analytics & BI", slug: "analytics-bi" },
      { name: "Customer Support", slug: "customer-support" },
      { name: "AI Tools", slug: "ai-tools" },
      { name: "Storage & File Sharing", slug: "storage" },
    ],
  },
  {
    name: "Infrastructure",
    slug: "infrastructure",
    icon: "server",
    color: "#0ea5e9",
    children: [
      { name: "Cloud Hosting", slug: "cloud-hosting" },
      { name: "Domains & DNS", slug: "domains-dns" },
      { name: "Databases", slug: "databases" },
      { name: "Monitoring & Logging", slug: "monitoring" },
      { name: "Email & Messaging APIs", slug: "email-messaging-apis" },
    ],
  },
  {
    name: "Media & Content",
    slug: "media-content",
    icon: "clapperboard",
    color: "#f59e0b",
    children: [
      { name: "Streaming & Entertainment", slug: "streaming" },
      { name: "Stock Assets & Fonts", slug: "stock-assets" },
      { name: "News & Publications", slug: "news-publications" },
      { name: "Learning & Courses", slug: "learning" },
    ],
  },
  {
    name: "Business Services",
    slug: "business-services",
    icon: "briefcase",
    color: "#10b981",
    children: [
      { name: "Memberships & Associations", slug: "memberships" },
      { name: "Legal & Compliance", slug: "legal-compliance" },
      { name: "Insurance", slug: "insurance" },
      { name: "Telecom & Connectivity", slug: "telecom" },
    ],
  },
  {
    name: "Other",
    slug: "other",
    icon: "circle-dashed",
    color: "#64748b",
    children: [{ name: "Uncategorised", slug: "uncategorised" }],
  },
];

export interface DefaultPaymentMethod {
  code: string;
  name: string;
  kind: PaymentMethodKind;
  isDefault?: boolean;
}

export const DEFAULT_PAYMENT_METHODS: DefaultPaymentMethod[] = [
  {
    code: "CORPORATE_CARD",
    name: "Corporate card",
    kind: "CARD",
    isDefault: true,
  },
  { code: "PERSONAL_CARD", name: "Personal card (reimbursed)", kind: "CARD" },
  { code: "BANK_TRANSFER", name: "Bank transfer", kind: "BANK" },
  { code: "INVOICE", name: "Invoice / purchase order", kind: "INVOICE" },
  { code: "WALLET", name: "PayPal / digital wallet", kind: "WALLET" },
  { code: "OTHER", name: "Other", kind: "OTHER" },
];

export const DEFAULT_BILLING_CYCLES: {
  cycle: BillingCycle;
  label: string;
  months: number;
}[] = [
  { cycle: "MONTHLY", label: "Monthly", months: 1 },
  { cycle: "QUARTERLY", label: "Quarterly", months: 3 },
  { cycle: "YEARLY", label: "Yearly", months: 12 },
  { cycle: "ONE_TIME", label: "One-time", months: 0 },
];

export async function ensureDefaultCategories(
  organizationId: string,
  db: Db = prisma
) {
  const existing = await db.category.count({ where: { organizationId } });
  if (existing > 0) return;
  let order = 0;
  for (const top of DEFAULT_CATEGORY_TREE) {
    const parent = await db.category.create({
      data: {
        organizationId,
        name: top.name,
        slug: top.slug,
        icon: top.icon,
        color: top.color,
        isDefault: true,
        sortOrder: order++,
      },
    });
    let childOrder = 0;
    for (const child of top.children) {
      await db.category.create({
        data: {
          organizationId,
          parentId: parent.id,
          name: child.name,
          slug: child.slug,
          isDefault: true,
          sortOrder: childOrder++,
        },
      });
    }
  }
}

export async function ensureDefaultPaymentMethods(
  organizationId: string,
  db: Db = prisma
) {
  const existing = await db.paymentMethodOption.count({
    where: { organizationId },
  });
  if (existing > 0) return;
  await db.paymentMethodOption.createMany({
    data: DEFAULT_PAYMENT_METHODS.map((m, i) => ({
      organizationId,
      code: m.code,
      name: m.name,
      kind: m.kind,
      isDefault: Boolean(m.isDefault),
      sortOrder: i,
    })),
  });
}

export async function ensureBillingCycleConfigs(
  organizationId: string,
  db: Db = prisma
) {
  for (const [i, c] of DEFAULT_BILLING_CYCLES.entries()) {
    await db.billingCycleConfig.upsert({
      where: { organizationId_cycle: { organizationId, cycle: c.cycle } },
      create: {
        organizationId,
        cycle: c.cycle,
        label: c.label,
        months: c.months,
        sortOrder: i,
      },
      update: {},
    });
  }
}

export async function ensureDefaultTaxRate(
  organizationId: string,
  countryCode: string,
  db: Db = prisma
) {
  const existing = await db.taxRate.count({ where: { organizationId } });
  if (existing > 0) return;
  const country = await db.country.findUnique({ where: { code: countryCode } });
  const rate = country?.defaultTaxRatePercent
    ? Number(country.defaultTaxRatePercent)
    : 0;
  await db.taxRate.create({
    data: {
      organizationId,
      name: rate > 0 ? `VAT ${rate}%` : "No tax",
      countryCode: country?.code ?? null,
      ratePercent: rate,
      isDefault: true,
    },
  });
}

/**
 * Seed everything a new organisation needs. `countryCode` defaults to the
 * registry default (general.countryCode) when not supplied.
 */
export async function ensureOrganizationDefaults(
  organizationId: string,
  options: { countryCode?: string; db?: Db } = {}
): Promise<void> {
  const db = options.db ?? prisma;
  const countryCode =
    options.countryCode ??
    (await getSetting(organizationId, "general.countryCode"));
  await ensureOrganizationRoles(organizationId, db);
  await ensureDefaultCategories(organizationId, db);
  await ensureDefaultPaymentMethods(organizationId, db);
  await ensureBillingCycleConfigs(organizationId, db);
  await ensureDefaultTaxRate(organizationId, countryCode, db);
}
