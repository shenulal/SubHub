// src/actions/auth-credentials.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerUser } from "./auth-credentials";

// Mock Prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    emailVerificationToken: {
      create: vi.fn(),
    },
  },
}));

// Mock email service
vi.mock("@/lib/deployment/tenancy", () => ({
  isSignupOpen: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/auth/password-policy", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/password-policy")>()),
  getSignupPasswordPolicy: vi.fn().mockResolvedValue({
    minLength: 10,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSymbol: true,
    historyCount: 0,
  }),
}));

vi.mock("@/lib/auth/auth-audit", () => ({
  AUTH_AUDIT_ACTIONS: { passwordChanged: "AUTH_PASSWORD_CHANGED" },
  recordAuthEvent: vi.fn(),
}));

vi.mock("@/lib/services/notification/email-auth", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock password utils
vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_password"),
}));

import { prisma } from "@/lib/db";

describe("auth-credentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerUser", () => {
    it("should register a new user successfully", async () => {
      const mockUser = {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        emailVerified: null,
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser as never);
      vi.mocked(prisma.emailVerificationToken.create).mockResolvedValue({
        id: "token-1",
        email: "test@example.com",
        token: "verification-token",
        expires: new Date(),
        createdAt: new Date(),
      } as never);

      const result = await registerUser({
        email: "test@example.com",
        password: "TestPassword123!",
        name: "Test User",
      });

      expect(result.message).toContain("Sign in");
      expect(result.success).toBe(true);
      expect(vi.mocked(prisma.user.create).mock.calls[0][0].data).toMatchObject(
        {
          email: "test@example.com",
          passwordHash: "hashed_password",
        }
      );
      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.emailVerificationToken.create).toHaveBeenCalled();
    });

    it("should reject registration with existing email", async () => {
      const existingUser = {
        id: "user-1",
        email: "existing@example.com",
        name: "Existing User",
        passwordHash: "hashed_password",
        accounts: [],
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        existingUser as never
      );

      const result = await registerUser({
        email: "existing@example.com",
        password: "TestPassword123!",
        name: "Test User",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("already");
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("returns EMAIL_EXISTS for an account without a password (no provider is revealed)", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        passwordHash: null,
      } as never);

      const result = await registerUser({
        email: "google@example.com",
        password: "TestPassword123!",
        name: "Test User",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("EMAIL_EXISTS");
      expect(result.message).not.toContain("Google");
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("rejects a password that breaks the policy", async () => {
      const result = await registerUser({
        email: "test@example.com",
        password: "alllowercase1!",
        name: "Test User",
      });
      expect(result.success).toBe(false);
      expect(result.errors?.password?.[0]).toContain("uppercase");
    });

    it("lower-cases the email and stores an optional user name", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({ id: "u" } as never);
      const result = await registerUser({
        email: "Jane@Example.com",
        password: "TestPassword123!",
        name: "Jane",
        username: "Jane.Doe",
      });
      expect(result.success).toBe(true);
      expect(vi.mocked(prisma.user.create).mock.calls[0][0].data).toMatchObject(
        {
          email: "jane@example.com",
          username: "jane.doe",
        }
      );
    });

    it("should return EMAIL_EXISTS_CREDENTIALS when email is registered with credentials", async () => {
      const existingUser = {
        id: "user-1",
        email: "credentials@example.com",
        name: "Credentials User",
        passwordHash: "hashed_password",
        accounts: [],
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        existingUser as never
      );

      const result = await registerUser({
        email: "credentials@example.com",
        password: "TestPassword123!",
        name: "Test User",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("EMAIL_EXISTS_CREDENTIALS");
      expect(result.message).toContain("already registered");
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("should return EMAIL_EXISTS for other OAuth providers", async () => {
      const existingUser = {
        id: "user-1",
        email: "oauth@example.com",
        name: "OAuth User",
        passwordHash: null,
        accounts: [{ provider: "okta" }],
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        existingUser as never
      );

      const result = await registerUser({
        email: "oauth@example.com",
        password: "TestPassword123!",
        name: "Test User",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("EMAIL_EXISTS");
      expect(result.message).toContain("already in use");
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("should reject registration with invalid email", async () => {
      const result = await registerUser({
        email: "invalid-email",
        password: "TestPassword123!",
        name: "Test User",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("email");
    });

    it("should reject registration with weak password", async () => {
      const result = await registerUser({
        email: "test@example.com",
        password: "weak",
        name: "Test User",
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it("should handle FormData input", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        emailVerified: null,
      } as never);
      vi.mocked(prisma.emailVerificationToken.create).mockResolvedValue({
        id: "token-1",
        email: "test@example.com",
        token: "verification-token",
        expires: new Date(),
        createdAt: new Date(),
      } as never);

      const formData = new FormData();
      formData.set("email", "test@example.com");
      formData.set("password", "TestPassword123!");
      formData.set("name", "Test User");

      const result = await registerUser(formData);

      expect(result.success).toBe(true);
    });
  });
});
