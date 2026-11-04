// src/lib/services/receipts/providers/gmail.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateAuthUrl = vi.fn();
const getToken = vi.fn();
const getAccessToken = vi.fn();
const revokeToken = vi.fn();
const setCredentials = vi.fn();
const messagesList = vi.fn();
const messagesGet = vi.fn();
const historyList = vi.fn();
const getProfile = vi.fn();

vi.mock("googleapis", () => {
  class OAuth2 {
    credentials: Record<string, unknown> = {};
    generateAuthUrl = generateAuthUrl;
    getToken = getToken;
    getAccessToken = getAccessToken;
    revokeToken = revokeToken;
    setCredentials = (c: Record<string, unknown>) => {
      this.credentials = { ...this.credentials, ...c };
      setCredentials(c);
    };
  }
  return {
    google: {
      auth: { OAuth2 },
      gmail: () => ({
        users: {
          getProfile,
          messages: { list: messagesList, get: messagesGet },
          history: { list: historyList },
        },
      }),
    },
  };
});

import {
  decodeBase64Url,
  extractBodies,
  gmailProvider,
  toRawMessage,
} from "./gmail";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const tokens = { accessToken: "a", refreshToken: "r", expiresAt: null };

describe("gmail provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GMAIL_CLIENT_ID = "gid";
    process.env.GMAIL_CLIENT_SECRET = "gsecret";
  });
  afterEach(() => {
    delete process.env.GMAIL_CLIENT_ID;
    delete process.env.GMAIL_CLIENT_SECRET;
  });

  it("decodes base64url and walks MIME parts", () => {
    expect(decodeBase64Url(b64("héllo $12.99"))).toBe("héllo $12.99");
    const bodies = extractBodies({
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/plain", body: { data: b64("plain") } },
        {
          mimeType: "multipart/related",
          parts: [
            { mimeType: "text/html", body: { data: b64("<b>html</b>") } },
          ],
        },
      ],
    });
    expect(bodies).toEqual({ text: "plain", html: "<b>html</b>" });
  });

  it("maps a Gmail message to RawMessage", () => {
    const raw = toRawMessage({
      id: "m1",
      threadId: "t1",
      snippet: "snip",
      internalDate: String(Date.UTC(2026, 0, 5)),
      payload: {
        headers: [
          { name: "From", value: "Notion <team@makenotion.com>" },
          { name: "subject", value: "Receipt" },
        ],
        mimeType: "text/plain",
        body: { data: b64("Total $12.00") },
      },
    });
    expect(raw).toMatchObject({
      id: "m1",
      threadId: "t1",
      from: "Notion <team@makenotion.com>",
      subject: "Receipt",
      bodyText: "Total $12.00",
      date: "2026-01-05T00:00:00.000Z",
    });
    expect(toRawMessage({})).toBeNull();
  });

  it("builds an offline-consent auth URL with the readonly scope", () => {
    generateAuthUrl.mockReturnValue(
      "https://accounts.google.com/o/oauth2/auth?x=1"
    );
    expect(gmailProvider.getAuthUrl("state-1", "https://app/cb")).toContain(
      "accounts.google.com"
    );
    expect(generateAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        access_type: "offline",
        prompt: "consent",
        state: "state-1",
        scope: ["https://www.googleapis.com/auth/gmail.readonly"],
      })
    );
  });

  it("throws NOT_CONFIGURED when no client credentials exist", () => {
    delete process.env.GMAIL_CLIENT_ID;
    const saved = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;
    expect(() => gmailProvider.getAuthUrl("s", "r")).toThrow(/not configured/);
    if (saved) process.env.GOOGLE_CLIENT_ID = saved;
  });

  it("exchanges a code for tokens", async () => {
    getToken.mockResolvedValue({
      tokens: {
        access_token: "at",
        refresh_token: "rt",
        expiry_date: 123,
        scope: "s",
      },
    });
    await expect(
      gmailProvider.exchangeCode("code", "https://app/cb")
    ).resolves.toEqual({
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: 123,
      scope: "s",
    });
    getToken.mockResolvedValue({ tokens: {} });
    await expect(
      gmailProvider.exchangeCode("code", "https://app/cb")
    ).rejects.toThrow(/access token/);
  });

  it("refreshes using the refresh token", async () => {
    getAccessToken.mockResolvedValue({ token: "fresh" });
    const result = await gmailProvider.refresh(tokens);
    expect(result.accessToken).toBe("fresh");
    expect(result.refreshToken).toBe("r");
    await expect(gmailProvider.refresh({ accessToken: "a" })).rejects.toThrow(
      /refresh token/
    );
  });

  it("reads the profile (email + historyId cursor)", async () => {
    getProfile.mockResolvedValue({
      data: { emailAddress: "me@acme.com", historyId: "99" },
    });
    await expect(gmailProvider.getProfile(tokens)).resolves.toEqual({
      email: "me@acme.com",
      cursor: "99",
    });
    getProfile.mockResolvedValue({ data: {} });
    await expect(gmailProvider.getProfile(tokens)).rejects.toThrow(/email/);
  });

  it("lists candidates by query on the first run and returns the new historyId", async () => {
    messagesList.mockResolvedValue({
      data: { messages: [{ id: "m1" }, { id: "m2" }] },
    });
    messagesGet.mockImplementation(async ({ id }: { id: string }) => ({
      data: {
        id,
        payload: {
          headers: [{ name: "Subject", value: "Receipt" }],
          mimeType: "text/plain",
          body: { data: b64("x") },
        },
      },
    }));
    getProfile.mockResolvedValue({ data: { historyId: "h2" } });

    const since = new Date("2026-01-01T00:00:00Z");
    const result = await gmailProvider.listCandidateMessages(tokens, {
      since,
      cursor: null,
      maxResults: 50,
    });

    expect(messagesList).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "me",
        q: expect.stringContaining(
          `after:${Math.floor(since.getTime() / 1000)}`
        ),
      })
    );
    expect(messagesList.mock.calls[0][0].q).toContain("receipt OR invoice");
    expect(result.messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(result.nextCursor).toBe("h2");
    expect(historyList).not.toHaveBeenCalled();
  });

  it("uses history when a cursor exists and prefilters by subject", async () => {
    historyList.mockResolvedValue({
      data: {
        history: [
          {
            messagesAdded: [
              { message: { id: "m1" } },
              { message: { id: "m2" } },
            ],
          },
        ],
      },
    });
    messagesGet.mockImplementation(
      async ({ id, format }: { id: string; format: string }) => ({
        data: {
          id,
          snippet: "",
          payload: {
            headers: [
              {
                name: "Subject",
                value: id === "m1" ? "Your invoice" : "Lunch?",
              },
            ],
            ...(format === "full"
              ? { mimeType: "text/plain", body: { data: b64("Total $1.00") } }
              : {}),
          },
        },
      })
    );
    getProfile.mockResolvedValue({ data: { historyId: "h3" } });

    const result = await gmailProvider.listCandidateMessages(tokens, {
      since: new Date(),
      cursor: "h1",
      maxResults: 50,
    });

    expect(historyList).toHaveBeenCalledWith(
      expect.objectContaining({
        startHistoryId: "h1",
        historyTypes: ["messageAdded"],
      })
    );
    expect(result.messages.map((m) => m.id)).toEqual(["m1"]);
    expect(messagesList).not.toHaveBeenCalled();
    expect(result.nextCursor).toBe("h3");
  });

  it("falls back to the query when the history cursor has expired", async () => {
    historyList.mockRejectedValue(
      Object.assign(new Error("not found"), { code: 404 })
    );
    messagesList.mockResolvedValue({ data: { messages: [{ id: "q1" }] } });
    messagesGet.mockResolvedValue({
      data: { id: "q1", payload: { headers: [] } },
    });
    getProfile.mockResolvedValue({ data: { historyId: "h9" } });

    const result = await gmailProvider.listCandidateMessages(tokens, {
      since: new Date(),
      cursor: "stale",
      maxResults: 10,
    });

    expect(messagesList).toHaveBeenCalled();
    expect(result.messages).toHaveLength(1);
  });

  it("rethrows non-404 history errors", async () => {
    historyList.mockRejectedValue(
      Object.assign(new Error("boom"), { code: 500 })
    );
    await expect(
      gmailProvider.listCandidateMessages(tokens, {
        since: new Date(),
        cursor: "h",
        maxResults: 10,
      })
    ).rejects.toThrow("boom");
  });

  it("revokes best-effort without throwing", async () => {
    revokeToken.mockRejectedValue(new Error("nope"));
    await expect(gmailProvider.revoke(tokens)).resolves.toBeUndefined();
    expect(revokeToken).toHaveBeenCalledWith("r");
  });
});
