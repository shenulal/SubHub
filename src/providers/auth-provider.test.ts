// src/providers/auth-provider.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authProvider } from "./auth-provider";

const mockSignIn = vi.fn();
const mockSignOut = vi.fn();
const mockFetch = vi.fn();

vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signOut: () => mockSignOut(),
}));

describe("authProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  describe("login", () => {
    it("signs in with the password provider and returns success", async () => {
      mockSignIn.mockResolvedValueOnce({ ok: true, error: undefined });

      const result = await authProvider.login?.({
        email: "test@example.com",
        password: "password",
      });

      expect(mockSignIn).toHaveBeenCalledWith("password", {
        identifier: "test@example.com",
        password: "password",
        redirect: false,
      });
      expect(result).toEqual({
        success: true,
        redirectTo: "/",
      });
    });

    it("returns the sign-in error code on failure", async () => {
      mockSignIn.mockResolvedValueOnce({
        ok: false,
        error: "CredentialsSignin",
        code: "invalid_credentials",
      });

      const result = await authProvider.login?.({
        username: "jane",
        password: "bad",
      });

      expect(mockSignIn).toHaveBeenCalledWith("password", {
        identifier: "jane",
        password: "bad",
        redirect: false,
      });
      expect(result).toMatchObject({
        success: false,
        error: { message: "invalid_credentials" },
      });
    });
  });

  describe("logout", () => {
    it("calls signOut and redirects to the login page", async () => {
      mockSignOut.mockResolvedValueOnce(undefined);

      const result = await authProvider.logout?.({});

      expect(mockSignOut).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        redirectTo: "/login",
      });
    });
  });

  describe("check", () => {
    it("returns authenticated when a session exists", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { id: "user-1" } }),
      });

      const result = await authProvider.check?.({});

      expect(mockFetch).toHaveBeenCalledWith("/api/auth/session", {
        credentials: "include",
      });
      expect(result).toEqual({
        authenticated: true,
      });
    });

    it("returns unauthenticated with a redirect when there is no session", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      });

      const result = await authProvider.check?.({});

      expect(mockFetch).toHaveBeenCalled();
      expect(result).toEqual({
        authenticated: false,
        redirectTo: "/login",
      });
    });
  });

  describe("getIdentity", () => {
    it("returns the session user identity", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: "user-1",
            email: "user@test.com",
            name: "Tester",
            role: "ADMIN",
            organizationId: "org-1",
          },
        }),
      });

      const result = await authProvider.getIdentity?.({});

      expect(result).toEqual({
        id: "user-1",
        email: "user@test.com",
        name: "Tester",
        role: "ADMIN",
        organizationId: "org-1",
      });
    });
  });

  describe("getPermissions", () => {
    it("returns the session user role", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { role: "ADMIN" } }),
      });

      const result = await authProvider.getPermissions?.({});

      expect(result).toBe("ADMIN");
    });
  });

  describe("onError", () => {
    it("returns logout with a redirect to the login page", async () => {
      const result = await authProvider.onError?.(new Error("test error"));

      expect(result).toEqual({
        logout: true,
        redirectTo: "/login",
      });
    });
  });
});
