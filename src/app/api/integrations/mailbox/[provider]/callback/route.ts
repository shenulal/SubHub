// src/app/api/integrations/mailbox/[provider]/callback/route.ts
/**
 * GET /api/integrations/mailbox/{gmail|outlook}/callback
 * Validates the signed state + cookie nonce, exchanges the code, stores the
 * encrypted tokens and redirects to /settings/mailboxes.
 */
import { auth } from "@/lib/auth";
import { withLogging } from "@/lib/logging";
import {
  buildRedirectUri,
  completeConnect,
  settingsRedirect,
  stateCookieOptions,
} from "@/lib/services/receipts/oauth-flow";
import { OAUTH_STATE_COOKIE } from "@/lib/services/receipts/oauth-state";
import { providerIdFromParam } from "@/lib/services/receipts/providers";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export const GET = withLogging(
  "GET /api/integrations/mailbox/[provider]/callback",
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
    const url = new URL(request.url);
    if (!session.user.organizationId) {
      return NextResponse.redirect(
        settingsRedirect(url.origin, { error: "session_mismatch" })
      );
    }

    const outcome = await completeConnect({
      provider,
      code: url.searchParams.get("code"),
      state: url.searchParams.get("state"),
      providerError: url.searchParams.get("error"),
      cookieNonce: request.cookies.get(OAUTH_STATE_COOKIE)?.value ?? null,
      session: {
        userId: session.user.id,
        organizationId: session.user.organizationId,
      },
      redirectUri: buildRedirectUri(provider, url.origin),
    });

    const target = outcome.ok
      ? settingsRedirect(url.origin, { connected: "1" })
      : settingsRedirect(url.origin, { error: outcome.error });
    if (outcome.ok) revalidatePath("/settings/mailboxes");

    const response = NextResponse.redirect(target);
    response.cookies.set({ ...stateCookieOptions(), value: "", maxAge: 0 });
    return response;
  }
);
