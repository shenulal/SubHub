// prisma/seeds/saas-catalog/types.ts
export type PricingModel =
  | "PER_SEAT"
  | "FLAT_RATE"
  | "USAGE_BASED"
  | "FREEMIUM";

export interface CatalogSeedEntry {
  name: string;
  /** Primary domain; also used for the logo, website and as an alias. */
  domain: string;
  /** Subcategory name from the default category tree. */
  sub: string;
  slug?: string;
  vendor?: string;
  description?: string;
  pricing?: PricingModel;
  /** USD list price per seat (or per month for flat-rate plans) where commonly known. */
  price?: number;
  aliases?: string[];
  cancelUrl?: string;
  portalUrl?: string;
  /** 3–5 concise cancellation steps. */
  steps: string[];
  noticeDays?: number;
  country?: string;
}

/** Subcategory → parent category, mirroring `DEFAULT_CATEGORY_TREE`. */
export const SUBCATEGORY_PARENT: Record<string, string> = {
  "Project Management": "Software",
  "Communication & Collaboration": "Software",
  "Design & Creative": "Software",
  "Development Tools": "Software",
  "Productivity & Office": "Software",
  "CRM & Sales": "Software",
  Marketing: "Software",
  "HR & Payroll": "Software",
  "Finance & Accounting": "Software",
  "Security & Identity": "Software",
  "Analytics & BI": "Software",
  "Customer Support": "Software",
  "AI Tools": "Software",
  "Storage & File Sharing": "Software",
  "Cloud Hosting": "Infrastructure",
  "Domains & DNS": "Infrastructure",
  Databases: "Infrastructure",
  "Monitoring & Logging": "Infrastructure",
  "Email & Messaging APIs": "Infrastructure",
  "Streaming & Entertainment": "Media & Content",
  "Stock Assets & Fonts": "Media & Content",
  "News & Publications": "Media & Content",
  "Learning & Courses": "Media & Content",
  "Memberships & Associations": "Business Services",
  "Legal & Compliance": "Business Services",
  Insurance: "Business Services",
  "Telecom & Connectivity": "Business Services",
  Uncategorised: "Other",
};
