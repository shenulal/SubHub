import { createIntegration, getIntegrations } from "@/actions/integrations";
import * as handler from "@/app/api/v1/integrations/route";
import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rbac/service", async () =>
  (await import("@/test/rbac-session-mock")).sessionRbacMock()
);
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/actions/integrations", () => ({
  getIntegrations: vi.fn(),
  createIntegration: vi.fn(),
}));

const mockAuth = vi.mocked(auth);
const mockGetIntegrations = vi.mocked(getIntegrations);
const mockCreateIntegration = vi.mocked(createIntegration);

describe("/api/v1/integrations contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("GET 401 when unauthenticated", async () => {
      mockAuth.mockResolvedValueOnce(null as never);

      const req = new NextRequest("http://localhost/api/v1/integrations");
      const res = await handler.GET(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json).toEqual({ error: "Authentication required" });
    });

    it("GET 403 when organizationId missing", async () => {
      mockAuth.mockResolvedValue({
        user: { id: "user-1", role: "ADMIN" },
      } as never);

      const req = new NextRequest("http://localhost/api/v1/integrations");
      const res = await handler.GET(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json).toEqual({ error: "Organization information is required" });
    });

    it("GET 200 with items/total", async () => {
      mockAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);
      mockGetIntegrations.mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const req = new NextRequest(
        "http://localhost/api/v1/integrations?page=1&limit=20"
      );
      const res = await handler.GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toHaveProperty("items");
      expect(json).toHaveProperty("total", 0);
    });

    it("GET parses a comma-separated status list and drops unknown values", async () => {
      mockAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);
      mockGetIntegrations.mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      await handler.GET(
        new NextRequest(
          "http://localhost/api/v1/integrations?status=ACTIVE,ERROR,BOGUS"
        )
      );

      expect(mockGetIntegrations).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({ status: ["ACTIVE", "ERROR"] }),
        })
      );
    });
  });

  describe("POST", () => {
    it("POST 401 when unauthenticated", async () => {
      mockAuth.mockResolvedValueOnce(null as never);

      const req = new NextRequest("http://localhost/api/v1/integrations", {
        method: "POST",
        body: JSON.stringify({ type: "GOOGLE_WORKSPACE" }),
      });
      const res = await handler.POST(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json).toEqual({ error: "Authentication required" });
    });

    it("POST 403 when not admin", async () => {
      mockAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "MEMBER" },
      } as never);

      const req = new NextRequest("http://localhost/api/v1/integrations", {
        method: "POST",
        body: JSON.stringify({ type: "GOOGLE_WORKSPACE" }),
      });
      const res = await handler.POST(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json).toEqual({
        success: false,
        error: "Forbidden: missing permission",
      });
    });

    it("POST 200 on success", async () => {
      mockAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);
      mockCreateIntegration.mockResolvedValueOnce({
        success: true,
        data: { id: "int-1" },
      } as never);

      const req = new NextRequest("http://localhost/api/v1/integrations", {
        method: "POST",
        body: JSON.stringify({
          type: "GOOGLE_WORKSPACE",
          credentials: {
            serviceAccountEmail: "service@project.iam.gserviceaccount.com",
            privateKey:
              "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
            adminEmail: "admin@example.com",
          },
        }),
      });
      const res = await handler.POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ success: true, data: { id: "int-1" } });
    });
  });
});
