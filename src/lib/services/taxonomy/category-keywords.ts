// src/lib/services/taxonomy/category-keywords.ts
/**
 * Keyword rules used by auto-categorisation. Each rule maps terms found in a
 * service name, vendor domain or catalog category string to a category slug
 * from the default tree (`organization-defaults.ts`). Order matters: the first
 * rule with a match wins, so put the more specific rules first.
 */

export interface CategoryKeywordRule {
  /** Target subcategory slug (child) in the default tree. */
  slug: string;
  /** Parent slug for the subcategory. */
  parentSlug: string;
  /** Lower-case keywords; matched as whole words or domain labels. */
  keywords: string[];
}

export const CATEGORY_KEYWORD_RULES: readonly CategoryKeywordRule[] = [
  {
    slug: "ai-tools",
    parentSlug: "software",
    keywords: [
      "openai",
      "chatgpt",
      "anthropic",
      "claude",
      "gemini",
      "midjourney",
      "copilot",
      "ai",
      "llm",
      "machine learning",
      "generative",
    ],
  },
  {
    slug: "project-management",
    parentSlug: "software",
    keywords: [
      "jira",
      "asana",
      "trello",
      "monday",
      "clickup",
      "basecamp",
      "linear",
      "project management",
      "task",
      "kanban",
      "roadmap",
    ],
  },
  {
    slug: "communication",
    parentSlug: "software",
    keywords: [
      "slack",
      "zoom",
      "teams",
      "meet",
      "webex",
      "discord",
      "loom",
      "communication",
      "messaging",
      "video conferencing",
      "chat",
      "collaboration",
    ],
  },
  {
    slug: "design",
    parentSlug: "software",
    keywords: [
      "figma",
      "canva",
      "adobe",
      "sketch",
      "invision",
      "miro",
      "design",
      "creative",
      "prototyping",
      "ui/ux",
      "graphic",
    ],
  },
  {
    slug: "development-tools",
    parentSlug: "software",
    keywords: [
      "github",
      "gitlab",
      "bitbucket",
      "jetbrains",
      "postman",
      "docker",
      "circleci",
      "developer",
      "development",
      "devops",
      "ci/cd",
      "ide",
      "code",
    ],
  },
  {
    slug: "productivity",
    parentSlug: "software",
    keywords: [
      "notion",
      "evernote",
      "office",
      "microsoft 365",
      "google workspace",
      "productivity",
      "notes",
      "documentation",
      "calendly",
      "docusign",
      "typeform",
      "zapier",
      "automation",
    ],
  },
  {
    slug: "crm-sales",
    parentSlug: "software",
    keywords: [
      "salesforce",
      "hubspot",
      "pipedrive",
      "zoho crm",
      "crm",
      "sales",
      "apollo",
      "outreach",
      "gong",
      "lead",
    ],
  },
  {
    slug: "marketing",
    parentSlug: "software",
    keywords: [
      "mailchimp",
      "klaviyo",
      "semrush",
      "ahrefs",
      "hootsuite",
      "buffer",
      "marketing",
      "seo",
      "advertising",
      "ads",
      "social media",
      "email marketing",
      "newsletter",
    ],
  },
  {
    slug: "hr-payroll",
    parentSlug: "software",
    keywords: [
      "bamboohr",
      "gusto",
      "rippling",
      "deel",
      "workday",
      "greenhouse",
      "lever",
      "hr",
      "payroll",
      "human resources",
      "recruiting",
      "hiring",
      "people",
    ],
  },
  {
    slug: "finance-accounting",
    parentSlug: "software",
    keywords: [
      "quickbooks",
      "xero",
      "stripe",
      "expensify",
      "brex",
      "ramp",
      "bill.com",
      "finance",
      "accounting",
      "invoicing",
      "billing",
      "expense",
      "payments",
      "bookkeeping",
    ],
  },
  {
    slug: "security",
    parentSlug: "software",
    keywords: [
      "1password",
      "lastpass",
      "okta",
      "auth0",
      "crowdstrike",
      "nordvpn",
      "cloudflare zero trust",
      "security",
      "identity",
      "password",
      "vpn",
      "sso",
      "mfa",
      "antivirus",
      "compliance",
    ],
  },
  {
    slug: "analytics-bi",
    parentSlug: "software",
    keywords: [
      "tableau",
      "looker",
      "power bi",
      "mixpanel",
      "amplitude",
      "hotjar",
      "analytics",
      "bi",
      "business intelligence",
      "dashboard",
      "reporting",
      "data",
    ],
  },
  {
    slug: "customer-support",
    parentSlug: "software",
    keywords: [
      "zendesk",
      "intercom",
      "freshdesk",
      "help scout",
      "support",
      "helpdesk",
      "customer service",
      "ticketing",
      "live chat",
    ],
  },
  {
    slug: "storage",
    parentSlug: "software",
    keywords: [
      "dropbox",
      "box",
      "google drive",
      "onedrive",
      "storage",
      "file sharing",
      "backup",
      "backblaze",
    ],
  },
  {
    slug: "cloud-hosting",
    parentSlug: "infrastructure",
    keywords: [
      "aws",
      "amazon web services",
      "azure",
      "google cloud",
      "gcp",
      "digitalocean",
      "vercel",
      "netlify",
      "heroku",
      "linode",
      "hosting",
      "cloud",
      "serverless",
      "cdn",
    ],
  },
  {
    slug: "domains-dns",
    parentSlug: "infrastructure",
    keywords: [
      "godaddy",
      "namecheap",
      "cloudflare",
      "route 53",
      "domain",
      "dns",
      "ssl",
      "certificate",
    ],
  },
  {
    slug: "databases",
    parentSlug: "infrastructure",
    keywords: [
      "mongodb",
      "supabase",
      "planetscale",
      "redis",
      "postgres",
      "database",
      "db",
      "neon",
      "firebase",
    ],
  },
  {
    slug: "monitoring",
    parentSlug: "infrastructure",
    keywords: [
      "datadog",
      "new relic",
      "sentry",
      "pagerduty",
      "grafana",
      "monitoring",
      "logging",
      "observability",
      "uptime",
      "apm",
      "incident",
    ],
  },
  {
    slug: "email-messaging-apis",
    parentSlug: "infrastructure",
    keywords: [
      "twilio",
      "sendgrid",
      "mailgun",
      "resend",
      "postmark",
      "email api",
      "sms",
      "messaging api",
      "transactional email",
    ],
  },
  {
    slug: "streaming",
    parentSlug: "media-content",
    keywords: [
      "netflix",
      "spotify",
      "youtube",
      "disney",
      "hulu",
      "apple music",
      "prime video",
      "streaming",
      "entertainment",
      "music",
      "podcast",
      "tv",
    ],
  },
  {
    slug: "stock-assets",
    parentSlug: "media-content",
    keywords: [
      "shutterstock",
      "getty",
      "envato",
      "unsplash",
      "adobe stock",
      "fonts",
      "stock",
      "assets",
      "icons",
      "templates",
    ],
  },
  {
    slug: "news-publications",
    parentSlug: "media-content",
    keywords: [
      "new york times",
      "financial times",
      "economist",
      "bloomberg",
      "wall street journal",
      "medium",
      "news",
      "publication",
      "magazine",
      "journal",
    ],
  },
  {
    slug: "learning",
    parentSlug: "media-content",
    keywords: [
      "coursera",
      "udemy",
      "pluralsight",
      "linkedin learning",
      "masterclass",
      "skillshare",
      "learning",
      "course",
      "training",
      "education",
      "e-learning",
    ],
  },
  {
    slug: "memberships",
    parentSlug: "business-services",
    keywords: [
      "membership",
      "association",
      "chamber",
      "club",
      "coworking",
      "wework",
    ],
  },
  {
    slug: "legal-compliance",
    parentSlug: "business-services",
    keywords: [
      "legal",
      "compliance",
      "contract",
      "lawyer",
      "vanta",
      "drata",
      "docusign legal",
      "gdpr",
      "iso 27001",
    ],
  },
  {
    slug: "insurance",
    parentSlug: "business-services",
    keywords: ["insurance", "insurer", "cover", "policy", "health plan"],
  },
  {
    slug: "telecom",
    parentSlug: "business-services",
    keywords: [
      "etisalat",
      "du",
      "stc",
      "mobily",
      "verizon",
      "at&t",
      "telecom",
      "mobile",
      "broadband",
      "internet",
      "connectivity",
      "sim",
    ],
  },
];

const DOMAIN_LABEL_SPLIT = /[.\-_/]/;

/** Normalises free text for matching: lower-case, collapsed whitespace. */
export function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchesKeyword(
  haystack: string,
  tokens: Set<string>,
  keyword: string
): boolean {
  if (keyword.includes(" ") || keyword.length <= 2) {
    // multi-word or very short keywords must match as whole phrase/token
    return keyword.includes(" ")
      ? haystack.includes(keyword)
      : tokens.has(keyword);
  }
  return tokens.has(keyword) || haystack.includes(keyword);
}

export interface KeywordMatch {
  rule: CategoryKeywordRule;
  keyword: string;
}

/**
 * Finds the first rule whose keyword appears in `text` (service name, catalog
 * category or vendor domain). Returns `null` when nothing matches.
 */
export function matchKeywordRule(
  text: string | null | undefined
): KeywordMatch | null {
  if (!text) return null;
  const haystack = normalizeForMatch(text);
  if (!haystack) return null;
  const tokens = new Set(
    haystack
      .split(DOMAIN_LABEL_SPLIT)
      .flatMap((part) => part.split(" "))
      .filter(Boolean)
  );
  for (const rule of CATEGORY_KEYWORD_RULES) {
    for (const keyword of rule.keywords) {
      if (matchesKeyword(haystack, tokens, keyword)) return { rule, keyword };
    }
  }
  return null;
}
