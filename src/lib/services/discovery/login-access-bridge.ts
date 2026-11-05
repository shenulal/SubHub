// src/lib/services/discovery/login-access-bridge.ts
/**
 * Login event → UserAppAccess bridge service
 * Converts logins detected in ExtensionLoginEvent into UserAppAccess records
 */

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { matchDomainToApp } from "./domain-matcher";

export interface BridgeLoginParams {
  domain: string;
  deviceId: string;
  organizationId: string;
  userId?: string;
  capturedAt: Date;
}

export interface BridgeResult {
  matched: boolean;
  appId?: string;
  appName?: string;
  userId?: string;
  confidence?: number;
}

/**
 * Bridges a login event to a UserAppAccess record
 *
 * 1. Resolve userId: provided directly or looked up from ExtensionDevice.userId
 * 2. Domain matching: calls matchDomainToApp()
 * 3. UserAppAccess upsert: source EXTENSION_LOGIN, refreshes lastUsedAt
 */
export async function bridgeLoginToAppAccess(
  params: BridgeLoginParams
): Promise<BridgeResult> {
  const { domain, deviceId, organizationId, capturedAt } = params;

  // 1. Resolve userId
  let userId = params.userId;

  if (!userId) {
    const device = await prisma.extensionDevice.findUnique({
      where: { deviceKey: deviceId },
      select: { userId: true },
    });

    userId = device?.userId ?? undefined;
  }

  if (!userId) {
    logger.debug(
      { deviceId, domain },
      "Login bridge skipped: userId not resolved"
    );
    return { matched: false };
  }

  // 2. Domain matching
  const matchResult = await matchDomainToApp(domain, organizationId);

  if (!matchResult) {
    logger.debug(
      { domain, organizationId },
      "Login bridge: no app match for domain"
    );
    return { matched: false, userId };
  }

  // 3. UserAppAccess upsert (EXTENSION_LOGIN source)
  // If an SSO_LOG record exists, refresh lastUsedAt only (source unchanged)
  const existing = await prisma.userAppAccess.findUnique({
    where: {
      userId_appId: {
        userId,
        appId: matchResult.appId,
      },
    },
    select: { source: true },
  });

  if (existing) {
    // If a record exists, refresh lastUsedAt only
    await prisma.userAppAccess.update({
      where: {
        userId_appId: {
          userId,
          appId: matchResult.appId,
        },
      },
      data: {
        lastUsedAt: capturedAt,
      },
    });
  } else {
    // Create a new record
    await prisma.userAppAccess.create({
      data: {
        userId,
        appId: matchResult.appId,
        source: "EXTENSION_LOGIN",
        lastUsedAt: capturedAt,
      },
    });
  }

  logger.info(
    {
      domain,
      appId: matchResult.appId,
      appName: matchResult.appName,
      userId,
      confidence: matchResult.confidence,
      matchTier: matchResult.matchTier,
      isNew: !existing,
    },
    "Login bridge: UserAppAccess created/updated"
  );

  return {
    matched: true,
    appId: matchResult.appId,
    appName: matchResult.appName,
    userId,
    confidence: matchResult.confidence,
  };
}
