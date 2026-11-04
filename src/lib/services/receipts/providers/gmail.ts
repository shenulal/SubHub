// src/lib/services/receipts/providers/gmail.ts
/**
 * Gmail provider — OAuth2 (gmail.readonly) via `googleapis`.
 * Cursor = Gmail `historyId`; when history has expired we fall back to a
 * date-bounded search query.
 */
import type { MailboxTokens, RawMessage } from "@/types/receipts";
import { google, type gmail_v1 } from "googleapis";
import {
  CANDIDATE_SEARCH_TERMS,
  looksLikeReceiptCandidate,
  MailboxProviderError,
  requireCredentials,
  toIsoDate,
  type MailboxProvider,
} from "./types";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const HISTORY_EXPIRED_STATUS = 404;

function oauthClient(redirectUri?: string) {
  const { clientId, clientSecret } = requireCredentials("GMAIL");
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function gmailClient(tokens: MailboxTokens): gmail_v1.Gmail {
  const client = oauthClient();
  client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken ?? undefined,
    expiry_date: tokens.expiresAt ?? undefined,
  });
  return google.gmail({ version: "v1", auth: client });
}

export function decodeBase64Url(data: string): string {
  const normalised = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalised, "base64").toString("utf8");
}

function header(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string {
  const found = headers?.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase()
  );
  return found?.value ?? "";
}

/** Walk MIME parts collecting the first text/plain and text/html bodies. */
export function extractBodies(part: gmail_v1.Schema$MessagePart | undefined): {
  text: string;
  html: string;
} {
  const out = { text: "", html: "" };
  const visit = (p: gmail_v1.Schema$MessagePart | undefined): void => {
    if (!p) return;
    const data = p.body?.data;
    if (data && p.mimeType === "text/plain" && !out.text)
      out.text = decodeBase64Url(data);
    else if (data && p.mimeType === "text/html" && !out.html)
      out.html = decodeBase64Url(data);
    p.parts?.forEach(visit);
  };
  visit(part);
  return out;
}

export function toRawMessage(
  message: gmail_v1.Schema$Message
): RawMessage | null {
  if (!message.id) return null;
  const headers = message.payload?.headers;
  const bodies = extractBodies(message.payload);
  return {
    id: message.id,
    threadId: message.threadId ?? undefined,
    from: header(headers, "From"),
    subject: header(headers, "Subject"),
    date: message.internalDate
      ? toIsoDate(Number(message.internalDate))
      : toIsoDate(header(headers, "Date")),
    snippet: message.snippet ?? "",
    bodyText: bodies.text,
    bodyHtml: bodies.html || undefined,
  };
}

function buildQuery(since: Date): string {
  const epochSeconds = Math.floor(since.getTime() / 1000);
  return `(${CANDIDATE_SEARCH_TERMS.join(" OR ")}) after:${epochSeconds}`;
}

async function listIdsByQuery(
  gmail: gmail_v1.Gmail,
  since: Date,
  maxResults: number
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: buildQuery(since),
      maxResults: Math.min(100, maxResults - ids.length),
      pageToken,
    });
    for (const m of res.data.messages ?? []) if (m.id) ids.push(m.id);
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken && ids.length < maxResults);
  return ids.slice(0, maxResults);
}

async function listIdsByHistory(
  gmail: gmail_v1.Gmail,
  startHistoryId: string,
  maxResults: number
): Promise<string[] | null> {
  const ids = new Set<string>();
  let pageToken: string | undefined;
  try {
    do {
      const res = await gmail.users.history.list({
        userId: "me",
        startHistoryId,
        historyTypes: ["messageAdded"],
        pageToken,
      });
      for (const h of res.data.history ?? []) {
        for (const added of h.messagesAdded ?? []) {
          if (added.message?.id) ids.add(added.message.id);
        }
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken && ids.size < maxResults);
  } catch (error) {
    const status =
      (error as { code?: number; status?: number }).code ??
      (error as { status?: number }).status;
    if (status === HISTORY_EXPIRED_STATUS) return null;
    throw error;
  }
  return Array.from(ids).slice(0, maxResults);
}

async function fetchFull(
  gmail: gmail_v1.Gmail,
  id: string
): Promise<RawMessage | null> {
  const res = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "full",
  });
  return toRawMessage(res.data);
}

async function prefilterByMetadata(
  gmail: gmail_v1.Gmail,
  ids: string[]
): Promise<string[]> {
  const keep: string[] = [];
  for (const id of ids) {
    const res = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "metadata",
      metadataHeaders: ["Subject"],
    });
    const subject = header(res.data.payload?.headers, "Subject");
    if (looksLikeReceiptCandidate(subject, res.data.snippet)) keep.push(id);
  }
  return keep;
}

export const gmailProvider: MailboxProvider = {
  id: "GMAIL",

  getAuthUrl(state, redirectUri) {
    return oauthClient(redirectUri).generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [GMAIL_SCOPE],
      state,
    });
  },

  async exchangeCode(code, redirectUri) {
    const { tokens } = await oauthClient(redirectUri).getToken(code);
    if (!tokens.access_token) {
      throw new MailboxProviderError(
        "Gmail did not return an access token",
        "AUTH"
      );
    }
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt: tokens.expiry_date ?? null,
      scope: tokens.scope ?? null,
    };
  },

  async refresh(tokens) {
    if (!tokens.refreshToken) {
      throw new MailboxProviderError("No refresh token available", "AUTH");
    }
    const client = oauthClient();
    client.setCredentials({ refresh_token: tokens.refreshToken });
    const { token } = await client.getAccessToken();
    if (!token)
      throw new MailboxProviderError("Gmail token refresh failed", "AUTH");
    return {
      accessToken: token,
      refreshToken: client.credentials.refresh_token ?? tokens.refreshToken,
      expiresAt: client.credentials.expiry_date ?? null,
      scope: client.credentials.scope ?? tokens.scope ?? null,
    };
  },

  async getProfile(tokens) {
    const res = await gmailClient(tokens).users.getProfile({ userId: "me" });
    if (!res.data.emailAddress) {
      throw new MailboxProviderError(
        "Gmail profile has no email address",
        "UPSTREAM"
      );
    }
    return { email: res.data.emailAddress, cursor: res.data.historyId ?? null };
  },

  async listCandidateMessages(tokens, options) {
    const gmail = gmailClient(tokens);
    let ids: string[] | null = null;
    if (options.cursor) {
      const added = await listIdsByHistory(
        gmail,
        options.cursor,
        options.maxResults
      );
      ids = added ? await prefilterByMetadata(gmail, added) : null;
    }
    if (ids === null) {
      ids = await listIdsByQuery(gmail, options.since, options.maxResults);
    }
    const messages: RawMessage[] = [];
    for (const id of ids) {
      const message = await fetchFull(gmail, id);
      if (message) messages.push(message);
    }
    const profile = await gmail.users.getProfile({ userId: "me" });
    return {
      messages,
      nextCursor: profile.data.historyId ?? options.cursor ?? null,
    };
  },

  async getMessage(tokens, id) {
    return fetchFull(gmailClient(tokens), id);
  },

  async revoke(tokens) {
    try {
      await oauthClient().revokeToken(
        tokens.refreshToken ?? tokens.accessToken
      );
    } catch {
      // best effort: the connection row is deleted regardless
    }
  },
};
