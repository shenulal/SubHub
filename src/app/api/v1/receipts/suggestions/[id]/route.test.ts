// src/app/api/v1/receipts/suggestions/[id]/route.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/logging", () => ({
  withLogging: vi.fn((_n: string, fn: unknown) => fn),
}));
vi.mock("@/lib/rbac/service", () => ({
  getUserPermissionSet: vi.fn(),
  hasAll: (set: Set<string>, keys: string[]) => keys.every((k) => set.has(k)),
  hasAny: (set: Set<string>, keys: string[]) => keys.some((k) => set.has(k)),
}));
vi.mock("@/actions/receipts", () => ({
  acceptReceiptSuggestion: vi.fn(),
  dismissReceiptSuggestions: vi.fn(),
  linkReceiptSuggestion: vi.fn(),
}));

import {
  acceptReceiptSuggestion,
  dismissReceiptSuggestions,
  linkReceiptSuggestion,
} from "@/actions/receipts";
import { auth } from "@/lib/auth";
import { getUserPermissionSet } from "@/lib/rbac/service";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mockAuth = vi.mocked(auth);
const mockPerms = vi.mocked(getUserPermissionSet);

function post(body: unknown) {
  return new NextRequest(
    "http://localhost:3000/api/v1/receipts/suggestions/sug-1",
    {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }
  );
}

describe("POST /api/v1/receipts/suggestions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "u1", organizationId: "o1", role: "MEMBER" },
      expires: "",
    } as never);
    mockPerms.mockResolvedValue(new Set(["mailboxes:connect_own"]));
  });

  it("401s without a session and 403s without permission", async () => {
    mockAuth.mockResolvedValue(null as never);
    expect((await POST(post({ action: "dismiss" }))).status).toBe(401);
    mockAuth.mockResolvedValue({
      user: { id: "u1", organizationId: "o1", role: "MEMBER" },
      expires: "",
    } as never);
    mockPerms.mockResolvedValue(new Set());
    expect((await POST(post({ action: "dismiss" }))).status).toBe(403);
  });

  it("rejects invalid JSON and unknown actions", async () => {
    expect((await POST(post("{not json"))).status).toBe(400);
    expect((await POST(post({ action: "explode" }))).status).toBe(400);
  });

  it("dispatches dismiss with the id from the path", async () => {
    vi.mocked(dismissReceiptSuggestions).mockResolvedValue({
      success: true,
      data: { count: 1 },
    });
    const res = await POST(post({ action: "dismiss" }));
    expect(dismissReceiptSuggestions).toHaveBeenCalledWith(["sug-1"]);
    expect(await res.json()).toMatchObject({
      success: true,
      data: { count: 1 },
    });
  });

  it("dispatches link and accept with validated payloads", async () => {
    vi.mocked(linkReceiptSuggestion).mockResolvedValue({
      success: true,
      data: { subscriptionId: "s" },
    });
    await POST(post({ action: "link", data: { subscriptionId: "s" } }));
    expect(linkReceiptSuggestion).toHaveBeenCalledWith("sug-1", {
      subscriptionId: "s",
      updateLastDetectedAmount: true,
    });

    vi.mocked(acceptReceiptSuggestion).mockResolvedValue({
      success: false,
      error: "Suggestion not found",
    });
    const res = await POST(
      post({
        action: "accept",
        data: {
          name: "Notion",
          amount: 12,
          currency: "usd",
          billingCycle: "MONTHLY",
          startDate: "2026-01-01",
        },
      })
    );
    expect(acceptReceiptSuggestion).toHaveBeenCalledWith(
      "sug-1",
      expect.objectContaining({ currency: "USD", isTrial: false })
    );
    expect(res.status).toBe(404);
  });

  it("maps validation errors to 400 and permission errors to 403", async () => {
    vi.mocked(dismissReceiptSuggestions).mockResolvedValue({
      success: false,
      error: "bad",
      errors: { ids: ["x"] },
    });
    expect((await POST(post({ action: "dismiss" }))).status).toBe(400);
    vi.mocked(dismissReceiptSuggestions).mockResolvedValue({
      success: false,
      error: "You do not have permission to perform this action",
    });
    expect((await POST(post({ action: "dismiss" }))).status).toBe(403);
  });
});
