// src/app/api/integrations/mailbox/[provider]/callback/route.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/logging", () => ({
  withLogging: vi.fn((_name: string, fn: unknown) => fn),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/receipts/oauth-flow", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/services/receipts/oauth-flow")>();
  return { ...actual, completeConnect: vi.fn() };
});

import { auth } from "@/lib/auth";
import { completeConnect } from "@/lib/services/receipts/oauth-flow";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mockAuth = vi.mocked(auth);
const mockComplete = vi.mocked(completeConnect);
const params = (provider: string) => ({
  params: Promise.resolve({ provider }),
});

function req(query: string, cookie?: string) {
  return new NextRequest(
    `http://localhost:3000/api/integrations/mailbox/gmail/callback?${query}`,
    {
      headers: cookie ? { cookie } : {},
    }
  );
}

describe("mailbox OAuth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "u1", organizationId: "o1", role: "MEMBER" },
      expires: "",
    } as never);
  });

  it("404s unknown providers and redirects anonymous users to login", async () => {
    expect((await GET(req("code=x"), params("yahoo"))).status).toBe(404);
    mockAuth.mockResolvedValue(null as never);
    const res = await GET(req("code=x"), params("gmail"));
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("passes code, state, cookie nonce and session to completeConnect and redirects on success", async () => {
    mockComplete.mockResolvedValue({
      ok: true,
      connectionId: "mb",
      email: "me@acme.com",
    });
    const res = await GET(
      req("code=abc&state=s.t", "subhub_mailbox_oauth=nonce-1"),
      params("gmail")
    );

    expect(mockComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "GMAIL",
        code: "abc",
        state: "s.t",
        cookieNonce: "nonce-1",
        session: { userId: "u1", organizationId: "o1" },
        redirectUri:
          "http://localhost:3000/api/integrations/mailbox/gmail/callback",
      })
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/settings/mailboxes?connected=1"
    );
    expect(res.headers.get("set-cookie")).toMatch(
      /subhub_mailbox_oauth=;.*Max-Age=0/
    );
  });

  it("redirects with the error code when state validation fails", async () => {
    mockComplete.mockResolvedValue({ ok: false, error: "invalid_state" });
    const res = await GET(req("code=abc&state=bad"), params("outlook"));
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/settings/mailboxes?error=invalid_state"
    );
    expect(mockComplete.mock.calls[0][0]).toMatchObject({
      provider: "OUTLOOK",
      cookieNonce: null,
    });
  });
});
