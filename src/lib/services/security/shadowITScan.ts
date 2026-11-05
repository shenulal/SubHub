// src/lib/services/security/shadowITScan.ts
import { prisma } from "@/lib/db";
import { sendShadowITAlertEmail } from "@/lib/services/notification/securityAlert";

// Organization settings type
interface OrganizationSettings {
  notifications?: {
    emailEnabled?: boolean;
    shadowITAlerts?: boolean;
  };
}

// AI tool keyword list (for Shadow IT detection)
const AI_TOOL_KEYWORDS = [
  // AI/LLM services
  "OPENAI",
  "CHATGPT",
  "GPT",
  "ANTHROPIC",
  "CLAUDE",
  "MIDJOURNEY",
  "DALLE",
  "BARD",
  "GEMINI",
  // AI coding tools
  "GITHUB COPILOT",
  "COPILOT",
  "TABNINE",
  "CODEIUM",
  "CURSOR",
  // AI productivity tools
  "JASPER",
  "NOTION AI",
  "GRAMMARLY",
  "PERPLEXITY",
  "COPY.AI",
  "WRITESONIC",
  // AI media tools
  "SYNTHESIA",
  "RUNWAY",
  "STABILITY",
  "ELEVENLABS",
  "HEYGEN",
  "DESCRIPT",
  // Other AI tools
  "REPLICATE",
  "HUGGINGFACE",
  "WEIGHTS & BIASES",
  "WANDB",
];

// Scan result type
export interface ShadowITScanResult {
  success: boolean;
  processedAt: Date;
  processedOrganizations: number;
  totalShadowApps: number;
  emailsSent: number;
  errors: string[];
}

// Shadow IT app type
interface ShadowApp {
  name: string;
  detectedAt: Date;
  source: string;
  transactionCount: number;
}

/**
 * Runs the Shadow IT scan
 * - Detects AI tool keywords in card transactions
 * - Checks whether the app is unapproved
 * - E-mails admins
 */
export async function processShadowITScan(): Promise<ShadowITScanResult> {
  const result: ShadowITScanResult = {
    success: true,
    processedAt: new Date(),
    processedOrganizations: 0,
    totalShadowApps: 0,
    emailsSent: 0,
    errors: [],
  };

  try {
    // Load all organizations (including notification settings)
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        settings: true,
        users: {
          where: { role: "ADMIN", status: "ACTIVE" },
          select: { email: true },
        },
      },
    });

    result.processedOrganizations = organizations.length;

    for (const org of organizations) {
      try {
        await processOrganization(
          {
            id: org.id,
            name: org.name,
            settings: org.settings,
            adminEmails: org.users.map((u) => u.email),
          },
          result
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        result.errors.push(`${org.id}: ${errorMessage}`);
      }
    }
  } catch (error) {
    result.success = false;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    result.errors.push(errorMessage);
  }

  return result;
}

// Process a single organization
async function processOrganization(
  org: {
    id: string;
    name: string;
    settings: unknown;
    adminEmails: string[];
  },
  result: ShadowITScanResult
): Promise<void> {
  const settings = org.settings as OrganizationSettings;
  const shadowITAlerts = settings?.notifications?.shadowITAlerts ?? true;
  const emailEnabled = settings?.notifications?.emailEnabled ?? true;

  // Skip when notifications are disabled
  if (!shadowITAlerts || !emailEnabled) {
    return;
  }

  // No admins
  if (org.adminEmails.length === 0) {
    result.errors.push(`${org.id}: No admin found`);
    return;
  }

  // Load the organization's approved apps
  const approvedApps = await prisma.app.findMany({
    where: {
      organizationId: org.id,
      status: "ACTIVE",
    },
    select: { name: true },
  });
  const approvedAppNames = new Set(
    approvedApps.map((a) => a.name.toUpperCase())
  );

  // Detect AI tool keywords in card transactions from the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const transactions = await prisma.cardTransaction.findMany({
    where: {
      organizationId: org.id,
      createdAt: { gte: sevenDaysAgo },
      matchedAppId: null, // Unmatched transactions only
    },
    select: {
      useStore: true,
      createdAt: true,
    },
  });

  // Match AI tool keywords
  const shadowAppsMap = new Map<string, ShadowApp>();

  for (const tx of transactions) {
    const storeName = tx.useStore.toUpperCase();

    for (const keyword of AI_TOOL_KEYWORDS) {
      if (storeName.includes(keyword)) {
        // Check whether the app is approved
        if (!approvedAppNames.has(keyword)) {
          const existing = shadowAppsMap.get(keyword);
          if (existing) {
            existing.transactionCount++;
          } else {
            shadowAppsMap.set(keyword, {
              name: keyword,
              detectedAt: tx.createdAt,
              source: "card",
              transactionCount: 1,
            });
          }
        }
        break; // Match one keyword only
      }
    }
  }

  const shadowApps = Array.from(shadowAppsMap.values());

  if (shadowApps.length === 0) {
    return;
  }

  result.totalShadowApps += shadowApps.length;

  // E-mail admins
  for (const adminEmail of org.adminEmails) {
    const emailResult = await sendShadowITAlertEmail({
      to: adminEmail,
      organizationName: org.name,
      shadowApps: shadowApps.map((app) => ({
        name: app.name,
        detectedAt: app.detectedAt,
        source: app.source,
      })),
    });

    if (emailResult.success) {
      result.emailsSent++;
    } else {
      result.errors.push(
        `${org.id}: Email delivery failed (${adminEmail}) - ${emailResult.error}`
      );
    }
  }
}
