/**
 * SaaS service matching logic
 * Matches card transaction merchant names to SaaS apps
 */

import type { ApprovalItem, PurchaseItem } from "./types";

/** Minimal App fields required for matching */
export type AppForMatching = { id: string; name: string };

/** Match result */
export interface MatchResult {
  appId: string | null;
  appName: string | null;
  confidence: number;
  matchedBy: "pattern" | "bizNo" | "exact" | null;
}

/** SaaS vendor pattern */
interface SaaSPattern {
  pattern: RegExp;
  appName: string;
  confidence: number;
}

/**
 * Built-in global SaaS patterns used to identify SaaS services from merchant names.
 * The Korean alternatives inside the regexes are functional matching data for
 * Korean card statements (Hyphen feed) and must stay in Korean.
 */
const GLOBAL_SAAS_PATTERNS: SaaSPattern[] = [
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
  {
    pattern: /ATLASSIAN|아틀라시안|JIRA|지라|CONFLUENCE|컨플루언스/i,
    appName: "Atlassian",
    confidence: 0.9,
  },
  { pattern: /JETBRAINS|젯브레인/i, appName: "JetBrains", confidence: 0.9 },
  { pattern: /VERCEL/i, appName: "Vercel", confidence: 0.9 },
  { pattern: /NETLIFY|네틀리파이/i, appName: "Netlify", confidence: 0.9 },
  { pattern: /HEROKU|헤로쿠/i, appName: "Heroku", confidence: 0.9 },
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
  { pattern: /MAILCHIMP|메일침프/i, appName: "Mailchimp", confidence: 0.9 },
  { pattern: /SENDGRID/i, appName: "SendGrid", confidence: 0.9 },

  // Design & media
  { pattern: /ADOBE|어도비/i, appName: "Adobe", confidence: 0.85 },
  { pattern: /CANVA|캔바/i, appName: "Canva", confidence: 0.9 },
  { pattern: /MIRO|미로/i, appName: "Miro", confidence: 0.9 },

  // Communications & messaging
  { pattern: /TWILIO/i, appName: "Twilio", confidence: 0.9 },

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
  { pattern: /LOOKER/i, appName: "Looker", confidence: 0.9 },

  // Korean services (Korean merchant-name patterns are functional data)
  { pattern: /카카오\s*(워크|WORK)/i, appName: "KakaoWork", confidence: 0.9 },
  {
    pattern: /네이버\s*(웍스|WORKS)/i,
    appName: "Naver Works",
    confidence: 0.9,
  },
  {
    pattern: /토스\s*(페이먼츠|PAYMENTS)/i,
    appName: "Toss Payments",
    confidence: 0.9,
  },
];

/**
 * Matches a card transaction to a SaaS app
 * @param transaction Transaction
 * @param apps The organization's registered apps
 * @param customPatterns Organization-specific custom patterns (optional)
 */
export function matchTransactionToApp(
  transaction: ApprovalItem | PurchaseItem,
  apps: AppForMatching[],
  customPatterns?: { pattern: string; appId: string }[]
): MatchResult {
  const merchantName = transaction.useStore;

  // 1. Match by custom pattern (highest priority)
  if (customPatterns) {
    for (const { pattern, appId } of customPatterns) {
      const regex = new RegExp(pattern, "i");
      if (regex.test(merchantName)) {
        const app = apps.find((a) => a.id === appId);
        if (app) {
          return {
            appId: app.id,
            appName: app.name,
            confidence: 1.0,
            matchedBy: "pattern",
          };
        }
      }
    }
  }

  // 2. Exact match by app name
  for (const app of apps) {
    if (merchantName.toLowerCase().includes(app.name.toLowerCase())) {
      return {
        appId: app.id,
        appName: app.name,
        confidence: 0.85,
        matchedBy: "exact",
      };
    }
  }

  // 3. Match by global SaaS pattern
  for (const { pattern, appName, confidence } of GLOBAL_SAAS_PATTERNS) {
    if (pattern.test(merchantName)) {
      // Find the app by the matched pattern name
      const app = apps.find(
        (a) => a.name.toLowerCase() === appName.toLowerCase()
      );
      if (app) {
        return {
          appId: app.id,
          appName: app.name,
          confidence,
          matchedBy: "pattern",
        };
      }
      // Report it as SaaS even if no app is registered
      return {
        appId: null,
        appName: appName,
        confidence,
        matchedBy: "pattern",
      };
    }
  }

  // No match
  return {
    appId: null,
    appName: null,
    confidence: 0,
    matchedBy: null,
  };
}

/**
 * Matches multiple transactions in bulk
 * @param transactions Transactions
 * @param apps The organization's registered apps
 * @param customPatterns Custom patterns
 */
export function batchMatchTransactions(
  transactions: (ApprovalItem | PurchaseItem)[],
  apps: AppForMatching[],
  customPatterns?: { pattern: string; appId: string }[]
): Map<string, MatchResult> {
  const results = new Map<string, MatchResult>();

  for (const transaction of transactions) {
    const key = `${transaction.apprNo}_${transaction.useDt}`;
    const result = matchTransactionToApp(transaction, apps, customPatterns);
    results.set(key, result);
  }

  return results;
}

/**
 * Extracts SaaS candidates from transactions
 * (for discovering SaaS not yet registered as apps)
 */
export function extractSaaSCandidates(
  transactions: (ApprovalItem | PurchaseItem)[]
): { name: string; count: number; totalAmount: number }[] {
  const candidates = new Map<string, { count: number; totalAmount: number }>();

  for (const transaction of transactions) {
    const merchantName = transaction.useStore;

    // Check against the global patterns
    for (const { pattern, appName } of GLOBAL_SAAS_PATTERNS) {
      if (pattern.test(merchantName)) {
        const existing = candidates.get(appName) || {
          count: 0,
          totalAmount: 0,
        };
        existing.count += 1;
        existing.totalAmount += parseInt(transaction.useAmt) || 0;
        candidates.set(appName, existing);
        break;
      }
    }
  }

  return Array.from(candidates.entries())
    .map(([name, data]) => ({
      name,
      count: data.count,
      totalAmount: data.totalAmount,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}
