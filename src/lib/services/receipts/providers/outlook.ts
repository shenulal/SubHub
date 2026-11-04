// src/lib/services/receipts/providers/outlook.ts
/**
 * Outlook / Microsoft 365 provider — Microsoft identity platform OAuth2 +
 * Microsoft Graph, implemented with `fetch`. Cursor = Graph delta link.
 */
import type {
  ListCandidateOptions,
  ListCandidateResult,
  MailboxProfile,
  MailboxTokens,
  RawMessage,
} from "@/types/receipts";
import {
  looksLikeReceiptCandidate,
  MailboxProviderError,
  requireCredentials,
  toIsoDate,
  type MailboxProvider,
} from "./types";

export const OUTLOOK_SCOPE = "offline_access Mail.Read User.Read";
const AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0";
const GRAPH = "https://graph.microsoft.com/v1.0";
const MESSAGE_SELECT =
  "id,conversationId,subject,from,receivedDateTime,bodyPreview,body";
const CURSOR_EXPIRED_STATUS = 410;

interface GraphMessage {
  id: string;
  conversationId?: string;
  subject?: string | null;
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime?: string;
  bodyPreview?: string;
  body?: { contentType?: "text" | "html"; content?: string };
  "@removed"?: unknown;
}

interface GraphPage {
  value?: GraphMessage[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

async function tokenRequest(
  body: Record<string, string>,
  redirectUri?: string
): Promise<MailboxTokens> {
  const { clientId, clientSecret } = requireCredentials("OUTLOOK");
  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: OUTLOOK_SCOPE,
    ...body,
    ...(redirectUri ? { redirect_uri: redirectUri } : {}),
  });
  const res = await fetch(`${AUTHORITY}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) {
    throw new MailboxProviderError(
      `Microsoft token endpoint returned ${res.status}`,
      "AUTH"
    );
  }
  const json = (await res.json()) as TokenResponse;
  if (!json.access_token) {
    throw new MailboxProviderError(
      "Microsoft did not return an access token",
      "AUTH"
    );
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: json.expires_in ? Date.now() + json.expires_in * 1000 : null,
    scope: json.scope ?? null,
  };
}

async function graphGet<T>(tokens: MailboxTokens, url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      Prefer: 'outlook.body-content-type="text"',
    },
  });
  if (res.status === 401) {
    throw new MailboxProviderError(
      "Microsoft Graph rejected the token",
      "AUTH"
    );
  }
  if (res.status === CURSOR_EXPIRED_STATUS) {
    throw new MailboxProviderError(
      "Graph delta link expired",
      "CURSOR_EXPIRED"
    );
  }
  if (res.status === 429) {
    throw new MailboxProviderError("Microsoft Graph rate limit", "RATE_LIMIT");
  }
  if (!res.ok) {
    throw new MailboxProviderError(
      `Microsoft Graph returned ${res.status}`,
      "UPSTREAM"
    );
  }
  return (await res.json()) as T;
}

export function toRawMessage(message: GraphMessage): RawMessage | null {
  if (!message.id || message["@removed"]) return null;
  const name = message.from?.emailAddress?.name;
  const address = message.from?.emailAddress?.address ?? "";
  const from = name ? `"${name}" <${address}>` : address;
  const isHtml = message.body?.contentType === "html";
  const content = message.body?.content ?? "";
  return {
    id: message.id,
    threadId: message.conversationId,
    from,
    subject: message.subject ?? "",
    date: toIsoDate(message.receivedDateTime),
    snippet: message.bodyPreview ?? "",
    bodyText: isHtml ? "" : content,
    bodyHtml: isHtml ? content : undefined,
  };
}

function initialDeltaUrl(since: Date): string {
  const params = new URLSearchParams({
    $select: MESSAGE_SELECT,
    $filter: `receivedDateTime ge ${since.toISOString()}`,
  });
  return `${GRAPH}/me/mailFolders/inbox/messages/delta?${params.toString()}`;
}

async function walkDelta(
  tokens: MailboxTokens,
  startUrl: string,
  maxResults: number
): Promise<ListCandidateResult> {
  const messages: RawMessage[] = [];
  let url: string | undefined = startUrl;
  let nextCursor: string | null = null;
  while (url) {
    const page: GraphPage = await graphGet<GraphPage>(tokens, url);
    for (const item of page.value ?? []) {
      if (!looksLikeReceiptCandidate(item.subject, item.bodyPreview)) continue;
      const raw = toRawMessage(item);
      if (raw) messages.push(raw);
    }
    if (page["@odata.deltaLink"]) {
      nextCursor = page["@odata.deltaLink"];
      url = undefined;
    } else if (messages.length >= maxResults && page["@odata.nextLink"]) {
      // Stop early; the continuation link is a valid cursor for the next run.
      nextCursor = page["@odata.nextLink"];
      url = undefined;
    } else {
      url = page["@odata.nextLink"];
    }
  }
  return { messages: messages.slice(0, maxResults), nextCursor };
}

export const outlookProvider: MailboxProvider = {
  id: "OUTLOOK",

  getAuthUrl(state, redirectUri) {
    const { clientId } = requireCredentials("OUTLOOK");
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope: OUTLOOK_SCOPE,
      state,
      prompt: "select_account",
    });
    return `${AUTHORITY}/authorize?${params.toString()}`;
  },

  exchangeCode(code, redirectUri) {
    return tokenRequest(
      { grant_type: "authorization_code", code },
      redirectUri
    );
  },

  async refresh(tokens) {
    if (!tokens.refreshToken) {
      throw new MailboxProviderError("No refresh token available", "AUTH");
    }
    const refreshed = await tokenRequest({
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    });
    return {
      ...refreshed,
      refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
    };
  },

  async getProfile(tokens): Promise<MailboxProfile> {
    const me = await graphGet<{ mail?: string; userPrincipalName?: string }>(
      tokens,
      `${GRAPH}/me?$select=mail,userPrincipalName`
    );
    const email = me.mail ?? me.userPrincipalName;
    if (!email) {
      throw new MailboxProviderError(
        "Graph profile has no email address",
        "UPSTREAM"
      );
    }
    return { email: email.toLowerCase(), cursor: null };
  },

  async listCandidateMessages(tokens, options: ListCandidateOptions) {
    if (options.cursor) {
      try {
        return await walkDelta(tokens, options.cursor, options.maxResults);
      } catch (error) {
        if (
          !(error instanceof MailboxProviderError) ||
          error.code !== "CURSOR_EXPIRED"
        )
          throw error;
      }
    }
    return walkDelta(
      tokens,
      initialDeltaUrl(options.since),
      options.maxResults
    );
  },

  async getMessage(tokens, id) {
    const params = new URLSearchParams({ $select: MESSAGE_SELECT });
    const message = await graphGet<GraphMessage>(
      tokens,
      `${GRAPH}/me/messages/${encodeURIComponent(id)}?${params.toString()}`
    );
    return toRawMessage(message);
  },

  async revoke() {
    // Microsoft Graph has no per-app token revocation endpoint; the user can
    // remove consent at https://myaccount.microsoft.com. Nothing to do here.
  },
};
