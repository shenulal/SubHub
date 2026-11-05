// src/lib/api/extension-auth.ts
/**
 * Extension API authentication middleware
 *
 * Used when the Chrome Extension authenticates with a Bearer token
 * Validates the token against the ExtensionApiToken table and returns the organizationId
 */

import { prisma } from "@/lib/db";
import type { ExtensionAuthContext } from "@/types/extension-api";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * Hashes the Bearer token and compares it with the stored value
 * Tokens are stored in the DB as SHA-256 hashes
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generates a new API token
 * Built from 32 random bytes, Base64URL-encoded
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Extracts the Bearer token from the Authorization header
 */
function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Performs Extension token authentication
 *
 * @param request - NextRequest object
 * @returns ExtensionAuthContext, or null on authentication failure
 */
export async function validateExtensionToken(
  request: NextRequest
): Promise<ExtensionAuthContext | null> {
  const rawToken = extractBearerToken(request);
  if (!rawToken) {
    return null;
  }

  const hashedToken = hashToken(rawToken);

  // Look up the token
  const tokenRecord = await prisma.extensionApiToken.findUnique({
    where: { token: hashedToken },
    select: {
      id: true,
      organizationId: true,
      deviceId: true,
      isActive: true,
      expiresAt: true,
    },
  });

  if (!tokenRecord) {
    return null;
  }

  // Check whether it is deactivated
  if (!tokenRecord.isActive) {
    return null;
  }

  // Check expiry
  if (tokenRecord.expiresAt && tokenRecord.expiresAt < new Date()) {
    return null;
  }

  // Update lastUsedAt (asynchronously to avoid delaying the response)
  prisma.extensionApiToken
    .update({
      where: { id: tokenRecord.id },
      data: { lastUsedAt: new Date() },
    })
    .catch((err) => {
      logger.error({ err }, "Failed to update token lastUsedAt");
    });

  return {
    organizationId: tokenRecord.organizationId,
    tokenId: tokenRecord.id,
    deviceId: tokenRecord.deviceId ?? undefined,
  };
}

// Handler type for Extension-authenticated requests
export type ExtensionAuthenticatedHandler = (
  request: NextRequest,
  context: { auth: ExtensionAuthContext }
) => Promise<NextResponse>;

import { logger } from "@/lib/logger";

/**
 * Extension API authentication wrapper (HOF)
 *
 * @example
 * ```typescript
 * export const GET = withExtensionAuth(async (request, { auth }) => {
 *   const data = await getData(auth.organizationId);
 *   return NextResponse.json({ success: true, data });
 * });
 * ```
 */
export function withExtensionAuth(handler: ExtensionAuthenticatedHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const auth = await validateExtensionToken(request);

    if (!auth) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid or missing token" },
        { status: 401 }
      );
    }

    // Log the authentication context
    logger.debug(
      {
        orgId: auth.organizationId,
        tokenId: auth.tokenId,
      },
      "ext-authenticated"
    );

    return handler(request, { auth });
  };
}
