// src/lib/services/category-normalizer.ts
/**
 * Normalises LLM categories to the standard UI dropdown categories
 * - Standard category constants and types
 * - Alias mapping table
 * - Normalisation function (pure, no side effects)
 */

/** The 10 standard categories shown in the UI dropdown */
export const APP_CATEGORIES = [
  "collaboration",
  "design",
  "ai",
  "productivity",
  "development",
  "marketing",
  "analytics",
  "security",
  "finance",
  "hr",
] as const;

export type AppCategoryValue = (typeof APP_CATEGORIES)[number];

/**
 * LLM output alias → standard category mapping (keys are lowercase)
 * Input is lowercased before lookup
 */
export const CATEGORY_ALIAS_MAP: Record<string, AppCategoryValue> = {
  // collaboration
  communication: "collaboration",
  messaging: "collaboration",
  "team chat": "collaboration",
  "video conferencing": "collaboration",
  email: "collaboration",
  workspace: "collaboration",

  // design
  "design tools": "design",
  "ui/ux": "design",
  "graphic design": "design",
  "creative tools": "design",
  prototyping: "design",

  // ai
  "ai/ml": "ai",
  "artificial intelligence": "ai",
  "machine learning": "ai",
  "generative ai": "ai",
  llm: "ai",

  // productivity
  "productivity tools": "productivity",
  "project management": "productivity",
  "task management": "productivity",
  "note-taking": "productivity",
  documentation: "productivity",
  office: "productivity",

  // development
  "developer tools": "development",
  devops: "development",
  engineering: "development",
  ide: "development",
  "cloud infrastructure": "development",
  "ci/cd": "development",
  hosting: "development",
  monitoring: "development",

  // marketing
  "marketing tools": "marketing",
  crm: "marketing",
  advertising: "marketing",
  seo: "marketing",
  "social media": "marketing",
  sales: "marketing",

  // analytics
  "data analytics": "analytics",
  "business intelligence": "analytics",
  bi: "analytics",
  reporting: "analytics",
  "data visualization": "analytics",

  // security
  cybersecurity: "security",
  "identity management": "security",
  iam: "security",
  authentication: "security",
  "password manager": "security",
  vpn: "security",
  compliance: "security",

  // finance
  fintech: "finance",
  accounting: "finance",
  billing: "finance",
  payments: "finance",
  invoicing: "finance",
  "expense management": "finance",
  payroll: "finance",

  // hr
  "human resources": "hr",
  recruitment: "hr",
  hiring: "hr",
  "talent management": "hr",
  onboarding: "hr",
  hris: "hr",
};

const STANDARD_SET = new Set<string>(APP_CATEGORIES);

/**
 * Normalises an LLM category value to a standard UI category
 *
 * 1. null/empty string → null
 * 2. Already a standard category → returned as-is
 * 3. Alias mapping hit → returns the standard category
 * 4. No mapping → returns the original value (custom categories allowed)
 */
export function normalizeCategory(raw: string | null): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();

  // Already a standard category
  if (STANDARD_SET.has(lower)) return lower;

  // Look up the alias mapping
  const mapped = CATEGORY_ALIAS_MAP[lower];
  if (mapped) return mapped;

  // No mapping: return the original value
  return trimmed;
}
