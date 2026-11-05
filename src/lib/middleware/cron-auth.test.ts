// src/lib/middleware/cron-auth.test.ts
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withCronAuth } from "./cron-auth";

describe("withCronAuth", () => {
  const mockHandler = vi
    .fn()
    .mockResolvedValue(NextResponse.json({ success: true }, { status: 200 }));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-secret");
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should return 401 when the Authorization header is missing", async () => {
    const handler = withCronAuth(mockHandler);
    const request = new NextRequest("http://localhost/api/cron/test");

    const response = await handler(request);

    expect(response.status).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("should return 401 when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;
    const handler = withCronAuth(mockHandler);
    const request = new NextRequest("http://localhost/api/cron/test", {
      headers: { authorization: "Bearer any-token" },
    });

    const response = await handler(request);

    expect(response.status).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("should return 401 for an invalid token", async () => {
    const handler = withCronAuth(mockHandler);
    const request = new NextRequest("http://localhost/api/cron/test", {
      headers: { authorization: "Bearer wrong-secret" },
    });

    const response = await handler(request);

    expect(response.status).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("should call the handler for a valid token", async () => {
    const handler = withCronAuth(mockHandler);
    const request = new NextRequest("http://localhost/api/cron/test", {
      headers: { authorization: "Bearer test-secret" },
    });

    const response = await handler(request);

    expect(response.status).toBe(200);
    expect(mockHandler).toHaveBeenCalledWith(request);
    const body = await response.json();
    expect(body).toEqual({ success: true });
  });

  describe("skipInDevelopment option", () => {
    it("passes without authentication in development with skipInDevelopment=true", async () => {
      vi.stubEnv("NODE_ENV", "development");
      const handler = withCronAuth(mockHandler, { skipInDevelopment: true });
      const request = new NextRequest("http://localhost/api/cron/test");

      const response = await handler(request);

      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalled();
    });

    it("requires authentication in development with skipInDevelopment=false", async () => {
      vi.stubEnv("NODE_ENV", "development");
      const handler = withCronAuth(mockHandler, { skipInDevelopment: false });
      const request = new NextRequest("http://localhost/api/cron/test");

      const response = await handler(request);

      expect(response.status).toBe(401);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("requires authentication in production with skipInDevelopment=true", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const handler = withCronAuth(mockHandler, { skipInDevelopment: true });
      const request = new NextRequest("http://localhost/api/cron/test");

      const response = await handler(request);

      expect(response.status).toBe(401);
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });
});
