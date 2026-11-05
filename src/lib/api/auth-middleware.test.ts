// src/lib/api/auth-middleware.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "./auth-middleware";

describe("withApiAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const handler = vi.fn();
    const wrappedHandler = withApiAuth(handler);

    const request = new NextRequest("http://localhost/api/test");
    const response = await wrappedHandler(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Authentication required");
    expect(handler).not.toHaveBeenCalled();
  });

  it("should return 401 when there is no user", async () => {
    vi.mocked(auth).mockResolvedValue({} as never);

    const handler = vi.fn();
    const wrappedHandler = withApiAuth(handler);

    const request = new NextRequest("http://localhost/api/test");
    const response = await wrappedHandler(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Authentication required");
    expect(handler).not.toHaveBeenCalled();
  });

  it("should return 403 when organizationId is missing", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", organizationId: null },
    } as never);

    const handler = vi.fn();
    const wrappedHandler = withApiAuth(handler);

    const request = new NextRequest("http://localhost/api/test");
    const response = await wrappedHandler(request);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Organization information is required");
    expect(handler).not.toHaveBeenCalled();
  });

  it("should call the handler for a valid session", async () => {
    const mockSession = {
      user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
    };
    vi.mocked(auth).mockResolvedValue(mockSession as never);

    const handler = vi
      .fn()
      .mockResolvedValue(NextResponse.json({ success: true }));
    const wrappedHandler = withApiAuth(handler);

    const request = new NextRequest("http://localhost/api/test");
    const response = await wrappedHandler(request);

    expect(handler).toHaveBeenCalledWith(request, { session: mockSession });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it("should pass the session context to the handler", async () => {
    const mockSession = {
      user: {
        id: "user-123",
        organizationId: "org-456",
        role: "MEMBER",
        email: "test@example.com",
      },
    };
    vi.mocked(auth).mockResolvedValue(mockSession as never);

    const handler = vi.fn().mockImplementation(async (_req, ctx) => {
      return NextResponse.json({
        userId: ctx.session.user.id,
        orgId: ctx.session.user.organizationId,
      });
    });
    const wrappedHandler = withApiAuth(handler);

    const request = new NextRequest("http://localhost/api/test");
    const response = await wrappedHandler(request);

    const body = await response.json();
    expect(body.userId).toBe("user-123");
    expect(body.orgId).toBe("org-456");
  });
});

describe("withApiAuth - admin permission check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 403 for non-ADMIN users with the requireAdmin option", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", organizationId: "org-1", role: "MEMBER" },
    } as never);

    const handler = vi.fn();
    const wrappedHandler = withApiAuth(handler, { requireAdmin: true });

    const request = new NextRequest("http://localhost/api/test");
    const response = await wrappedHandler(request);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Admin permission required");
    expect(handler).not.toHaveBeenCalled();
  });

  it("should call the handler for ADMIN users with the requireAdmin option", async () => {
    const mockSession = {
      user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
    };
    vi.mocked(auth).mockResolvedValue(mockSession as never);

    const handler = vi
      .fn()
      .mockResolvedValue(NextResponse.json({ success: true }));
    const wrappedHandler = withApiAuth(handler, { requireAdmin: true });

    const request = new NextRequest("http://localhost/api/test");
    const response = await wrappedHandler(request);

    expect(handler).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });
});
