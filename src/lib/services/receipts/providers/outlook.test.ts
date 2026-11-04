// src/lib/services/receipts/providers/outlook.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { outlookProvider, toRawMessage } from "./outlook";

const fetchMock = vi.fn();
const tokens = { accessToken: "a", refreshToken: "r", expiresAt: null };

function json(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("outlook provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    process.env.MS_GRAPH_CLIENT_ID = "mid";
    process.env.MS_GRAPH_CLIENT_SECRET = "msecret";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.MS_GRAPH_CLIENT_ID;
    delete process.env.MS_GRAPH_CLIENT_SECRET;
  });

  it("maps Graph messages to RawMessage (text and html bodies)", () => {
    const text = toRawMessage({
      id: "g1",
      conversationId: "c1",
      subject: "Invoice",
      from: { emailAddress: { name: "Figma", address: "billing@figma.com" } },
      receivedDateTime: "2026-01-05T10:00:00Z",
      bodyPreview: "preview",
      body: { contentType: "text", content: "Total £10.00" },
    });
    expect(text).toMatchObject({
      id: "g1",
      threadId: "c1",
      from: '"Figma" <billing@figma.com>',
      bodyText: "Total £10.00",
      date: "2026-01-05T10:00:00.000Z",
    });
    const html = toRawMessage({
      id: "g2",
      from: { emailAddress: { address: "x@y.com" } },
      body: { contentType: "html", content: "<p>hi</p>" },
    });
    expect(html).toMatchObject({
      from: "x@y.com",
      bodyText: "",
      bodyHtml: "<p>hi</p>",
    });
    expect(
      toRawMessage({ id: "g3", "@removed": { reason: "deleted" } })
    ).toBeNull();
  });

  it("builds the authorize URL with the common tenant and offline scope", () => {
    const url = new URL(outlookProvider.getAuthUrl("st", "https://app/cb"));
    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
    );
    expect(url.searchParams.get("client_id")).toBe("mid");
    expect(url.searchParams.get("scope")).toBe(
      "offline_access Mail.Read User.Read"
    );
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app/cb");
  });

  it("exchanges the code via the token endpoint", async () => {
    fetchMock.mockResolvedValue(
      json({
        access_token: "at",
        refresh_token: "rt",
        expires_in: 3600,
        scope: "Mail.Read",
      })
    );
    const before = Date.now();
    const result = await outlookProvider.exchangeCode("code", "https://app/cb");
    expect(result).toMatchObject({
      accessToken: "at",
      refreshToken: "rt",
      scope: "Mail.Read",
    });
    expect(result.expiresAt).toBeGreaterThanOrEqual(before + 3600 * 1000 - 50);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token"
    );
    const body = new URLSearchParams(init.body);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("client_secret")).toBe("msecret");
    expect(body.get("redirect_uri")).toBe("https://app/cb");
  });

  it("surfaces token endpoint failures as AUTH errors", async () => {
    fetchMock.mockResolvedValue(json({ error: "invalid_grant" }, 400));
    await expect(outlookProvider.exchangeCode("bad", "r")).rejects.toThrow(
      /400/
    );
    fetchMock.mockResolvedValue(json({}));
    await expect(outlookProvider.exchangeCode("bad", "r")).rejects.toThrow(
      /access token/
    );
  });

  it("refreshes and keeps the old refresh token when none is returned", async () => {
    fetchMock.mockResolvedValue(json({ access_token: "new", expires_in: 10 }));
    const result = await outlookProvider.refresh(tokens);
    expect(result).toMatchObject({ accessToken: "new", refreshToken: "r" });
    await expect(outlookProvider.refresh({ accessToken: "a" })).rejects.toThrow(
      /refresh token/
    );
  });

  it("reads the profile email", async () => {
    fetchMock.mockResolvedValue(json({ mail: "Me@Acme.com" }));
    await expect(outlookProvider.getProfile(tokens)).resolves.toEqual({
      email: "me@acme.com",
      cursor: null,
    });
    fetchMock.mockResolvedValue(json({ userPrincipalName: "upn@acme.com" }));
    expect((await outlookProvider.getProfile(tokens)).email).toBe(
      "upn@acme.com"
    );
    fetchMock.mockResolvedValue(json({}));
    await expect(outlookProvider.getProfile(tokens)).rejects.toThrow(/email/);
  });

  it("walks the initial delta feed, prefilters, and returns the delta link", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({
          value: [
            {
              id: "1",
              subject: "Your invoice",
              bodyPreview: "",
              body: { contentType: "text", content: "$1" },
            },
            {
              id: "2",
              subject: "Lunch",
              bodyPreview: "",
              body: { contentType: "text", content: "" },
            },
          ],
          "@odata.nextLink": "https://graph.microsoft.com/v1.0/next",
        })
      )
      .mockResolvedValueOnce(
        json({
          value: [
            {
              id: "3",
              subject: "Payment received",
              body: { contentType: "text", content: "" },
            },
          ],
          "@odata.deltaLink": "https://graph/delta?token=abc",
        })
      );

    const since = new Date("2026-01-01T00:00:00Z");
    const result = await outlookProvider.listCandidateMessages(tokens, {
      since,
      cursor: null,
      maxResults: 50,
    });

    const firstUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(firstUrl.pathname).toBe("/v1.0/me/mailFolders/inbox/messages/delta");
    expect(firstUrl.searchParams.get("$filter")).toBe(
      `receivedDateTime ge ${since.toISOString()}`
    );
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer a");
    expect(result.messages.map((m) => m.id)).toEqual(["1", "3"]);
    expect(result.nextCursor).toBe("https://graph/delta?token=abc");
  });

  it("resumes from the stored delta link and falls back when it expired", async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 410))
      .mockResolvedValueOnce(json({ value: [], "@odata.deltaLink": "fresh" }));

    const result = await outlookProvider.listCandidateMessages(tokens, {
      since: new Date(),
      cursor: "https://graph/delta?token=old",
      maxResults: 10,
    });

    expect(fetchMock.mock.calls[0][0]).toBe("https://graph/delta?token=old");
    expect(result.nextCursor).toBe("fresh");
  });

  it("stops early at maxResults and hands back the continuation link", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        value: [
          { id: "1", subject: "Receipt" },
          { id: "2", subject: "Receipt" },
        ],
        "@odata.nextLink": "https://graph/next",
      })
    );
    const result = await outlookProvider.listCandidateMessages(tokens, {
      since: new Date(),
      cursor: null,
      maxResults: 1,
    });
    expect(result.messages).toHaveLength(1);
    expect(result.nextCursor).toBe("https://graph/next");
  });

  it("maps Graph error statuses", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 401));
    await expect(outlookProvider.getMessage(tokens, "x")).rejects.toThrow(
      /rejected the token/
    );
    fetchMock.mockResolvedValueOnce(json({}, 429));
    await expect(outlookProvider.getMessage(tokens, "x")).rejects.toThrow(
      /rate limit/
    );
    fetchMock.mockResolvedValueOnce(json({}, 500));
    await expect(outlookProvider.getMessage(tokens, "x")).rejects.toThrow(
      /500/
    );
  });

  it("fetches a single message", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        id: "x",
        subject: "S",
        from: { emailAddress: { address: "a@b.co" } },
      })
    );
    const raw = await outlookProvider.getMessage(tokens, "x");
    expect(raw?.subject).toBe("S");
    expect(fetchMock.mock.calls[0][0]).toContain("/me/messages/x?");
    await expect(outlookProvider.revoke(tokens)).resolves.toBeUndefined();
  });
});
