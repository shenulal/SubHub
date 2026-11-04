// src/app/api/integrations/mailbox/[provider]/connect/route.ts
/**
 * GET /api/integrations/mailbox/{gmail|outlook}/connect
 * Starts the read-only mailbox OAuth consent. Requires a session with
 * `mailboxes:connect_own`. The signed state nonce is mirrored in an httpOnly cookie.
 */
import { auth } from "@/lib/auth";
import { withLogging } from "@/lib/logging";
import { getUserPermissionSet, hasAny } from "@/lib/rbac/service";
import {
  beginConnect,
  buildRedirectUri,
  stateCookieOptions,
} from "@/lib/services/receipts/oauth-flow";
import {
  MailboxProviderError,
  providerIdFromParam,
} from "@/lib/services/receipts/providers";
import { NextRequest, NextResponse } from "next/server";

export const GET = withLogging(
  "GET /api/integrations/mailbox/[provider]/connect",
  async (
    request: NextRequest,
    context: { params: Promise<{ provider: string }> }
  ) => {
    const { provider: providerParam } = await context.params;
    const provider = providerIdFromParam(providerParam);
    if (!provider) {
      return NextResponse.json(
        { success: false, error: "Unknown provider" },
        { status: 404 }
      );
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (!session.user.organizationId) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
    const permissions = await getUserPermissionSet(
      session.user.id,
      session.user.organizationId
    );
    if (!hasAny(permissions, ["mailboxes:connect_own", "mailboxes:manage"])) {
      return NextResponse.json(
        { success: false, error: "Forbidden: missing permission" },
        { status: 403 }
      );
    }

    const origin = new URL(request.url).origin;
    try {
      const { authUrl, nonce } = beginConnect({
        provider,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        redirectUri: buildRedirectUri(provider, origin),
      });
      const response = NextResponse.redirect(authUrl);
      response.cookies.set({ ...stateCookieOptions(), value: nonce });
      return response;
    } catch (error) {
      if (
        error instanceof MailboxProviderError &&
        error.code === "NOT_CONFIGURED"
      ) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 503 }
        );
      }
      throw error;
    }
  }
);
