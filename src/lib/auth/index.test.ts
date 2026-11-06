// src/lib/auth/index.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the NextAuth module
vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

// Prisma mock
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// PrismaAdapter mock
vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: vi.fn(() => ({})),
}));

// Credentials provider mock: keeps id/name so the configured providers can be inspected
vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn((options: Record<string, unknown>) => ({
    type: "credentials",
    ...options,
  })),
}));

describe("NextAuth configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("exports", () => {
    it("should export auth, signIn, signOut and handlers", async () => {
      const authModule = await import("./index");

      expect(authModule.auth).toBeDefined();
      expect(authModule.signIn).toBeDefined();
      expect(authModule.signOut).toBeDefined();
      expect(authModule.handlers).toBeDefined();
    });

    it("handlers should include GET and POST", async () => {
      const { handlers } = await import("./index");

      expect(handlers).toHaveProperty("GET");
      expect(handlers).toHaveProperty("POST");
    });
  });

  describe("configuration structure", () => {
    it("should call NextAuth with the correct configuration", async () => {
      const NextAuth = (await import("next-auth")).default;

      // Clear the cache to reload the module
      vi.resetModules();
      await import("./index");

      expect(NextAuth).toHaveBeenCalled();
      const config = vi.mocked(NextAuth).mock
        .calls[0]?.[0] as unknown as Record<string, unknown>;

      // Check the adapter configuration
      expect(config).toHaveProperty("adapter");

      // Check the providers configuration
      expect(config).toHaveProperty("providers");
      expect(Array.isArray(config?.providers)).toBe(true);

      // Password + email-code credentials providers, no Google sign-in
      const providers = config?.providers as Array<{ id?: string }>;
      const ids = providers.map((p) => p.id);
      expect(ids).toContain("password");
      expect(ids).toContain("credentials");
      expect(ids).not.toContain("google");

      // Check the callbacks configuration
      expect(config).toHaveProperty("callbacks");
      const callbacks = config?.callbacks as Record<string, unknown>;
      expect(callbacks).toHaveProperty("session");

      // Check the pages configuration
      expect(config).toHaveProperty("pages");
      const pages = config?.pages as Record<string, unknown>;
      expect(pages?.signIn).toBe("/login");
    });
  });
});
