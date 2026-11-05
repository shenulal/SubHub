// src/lib/services/payment/merchant-matcher.constants.ts

// Card network / payment processor prefixes
export const PAYMENT_PREFIXES = [
  "PP*", // PayPal
  "PAYPAL*",
  "GOOGLE*",
  "APPLE*",
  "SQ*", // Square
  "STRIPE*",
  "PADDLE*",
  "FASTSPRING*",
];

// Country code suffixes
export const COUNTRY_CODES = [
  "US",
  "USA",
  "KR",
  "KOR",
  "JP",
  "JPN",
  "UK",
  "GB",
  "DE",
  "FR",
  "AU",
  "CA",
  "SG",
  "HK",
];

// Business entity suffixes (the Korean entries are functional: they strip Korean company-type suffixes from Korean card statements)
export const BUSINESS_SUFFIXES = [
  "INC",
  "INCORPORATED",
  "LLC",
  "LTD",
  "LIMITED",
  "CORP",
  "CORPORATION",
  "CO",
  "COMPANY",
  "GmbH",
  "AG",
  "SA",
  "PTE",
  "BV",
  "NV",
  "AS",
  "AB",
  "주식회사",
  "유한회사",
  "유한책임회사",
];

// Global SaaS patterns (for Layer 1). Korean alternatives inside the regexes are
// functional matching data for Korean card statements and must stay in Korean.
export const GLOBAL_SAAS_PATTERNS: Array<{
  pattern: RegExp;
  appName: string;
  confidence: number;
}> = [
  // Cloud & infrastructure
  { pattern: /AWS|AMAZON\s*WEB\s*SERVICES/i, appName: "AWS", confidence: 0.95 },
  {
    pattern: /GOOGLE\s*(CLOUD|GCP)|GCP/i,
    appName: "Google Cloud",
    confidence: 0.95,
  },
  {
    pattern: /MICROSOFT\s*AZURE|AZURE/i,
    appName: "Microsoft Azure",
    confidence: 0.95,
  },
  // Collaboration & productivity
  {
    pattern: /GOOGLE\s*(WORKSPACE|APPS)/i,
    appName: "Google Workspace",
    confidence: 0.95,
  },
  {
    pattern: /MICROSOFT\s*365|M365|OFFICE\s*365/i,
    appName: "Microsoft 365",
    confidence: 0.95,
  },
  { pattern: /SLACK|슬랙/i, appName: "Slack", confidence: 0.9 },
  { pattern: /NOTION|노션/i, appName: "Notion", confidence: 0.9 },
  { pattern: /FIGMA|피그마/i, appName: "Figma", confidence: 0.9 },
  { pattern: /ZOOM|줌/i, appName: "Zoom", confidence: 0.85 },
  { pattern: /DROPBOX|드롭박스/i, appName: "Dropbox", confidence: 0.9 },
  // Developer tools
  { pattern: /GITHUB|깃허브/i, appName: "GitHub", confidence: 0.9 },
  { pattern: /GITLAB|깃랩/i, appName: "GitLab", confidence: 0.9 },
  { pattern: /CURSOR|커서/i, appName: "Cursor", confidence: 0.9 },
  {
    pattern: /ATLASSIAN|아틀라시안|JIRA|지라|CONFLUENCE|컨플루언스/i,
    appName: "Atlassian",
    confidence: 0.9,
  },
  { pattern: /JETBRAINS|젯브레인/i, appName: "JetBrains", confidence: 0.9 },
  { pattern: /VERCEL/i, appName: "Vercel", confidence: 0.9 },
  { pattern: /NETLIFY|네틀리파이/i, appName: "Netlify", confidence: 0.9 },
  { pattern: /DATADOG/i, appName: "Datadog", confidence: 0.9 },
  // CRM & marketing
  {
    pattern: /SALESFORCE|세일즈포스/i,
    appName: "Salesforce",
    confidence: 0.95,
  },
  { pattern: /HUBSPOT|허브스팟/i, appName: "HubSpot", confidence: 0.9 },
  { pattern: /ZENDESK|젠데스크/i, appName: "Zendesk", confidence: 0.9 },
  { pattern: /INTERCOM|인터콤/i, appName: "Intercom", confidence: 0.9 },
  // Design & media
  { pattern: /ADOBE|어도비/i, appName: "Adobe", confidence: 0.85 },
  { pattern: /CANVA|캔바/i, appName: "Canva", confidence: 0.9 },
  { pattern: /MIRO|미로/i, appName: "Miro", confidence: 0.9 },
  // Security & identity
  { pattern: /OKTA|옥타/i, appName: "Okta", confidence: 0.9 },
  { pattern: /AUTH0/i, appName: "Auth0", confidence: 0.9 },
  // Data & analytics
  {
    pattern: /SNOWFLAKE|스노우플레이크/i,
    appName: "Snowflake",
    confidence: 0.9,
  },
  { pattern: /TABLEAU|태블로/i, appName: "Tableau", confidence: 0.9 },
  // Korean services
  { pattern: /카카오\s*(워크|WORK)/i, appName: "KakaoWork", confidence: 0.9 },
  {
    pattern: /네이버\s*(웍스|WORKS)/i,
    appName: "Naver Works",
    confidence: 0.9,
  },
];
