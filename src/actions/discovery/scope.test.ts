// src/actions/discovery/scope.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, getCachedSession, requireAuth, getSetting, cookieStore } =
  vi.hoisted(() => {
    const prisma = { user: { findUnique: vi.fn(), update: vi.fn() } };
    const getCachedSession = vi.fn();
    const requireAuth = vi.fn();
    const getSetting = vi.fn();
    const cookieStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
    return { prisma, getCachedSession, requireAuth, getSetting, cookieStore };
  });

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/auth/require-auth", () => ({
  getCachedSession: () => getCachedSession(),
  requireAuth: () => requireAuth(),
}));
vi.mock("@/lib/settings/service", () => ({
  getSetting: (...args: unknown[]) => getSetting(...args),
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

import { getWorkspaceScope, setWorkspaceScope } from "./scope";

const session = { user: { id: "u1", organizationId: "org-1" } };

describe("workspace scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCachedSession.mockResolvedValue(session);
    requireAuth.mockResolvedValue(session);
    getSetting.mockResolvedValue(true);
    cookieStore.get.mockReturnValue(undefined);
    prisma.user.findUnique.mockResolvedValue({ preferences: {} });
  });

  it("prefers the cookie, then user preferences, then workspace", async () => {
    cookieStore.get.mockReturnValue({ value: "personal" });
    expect(await getWorkspaceScope()).toEqual({
      scope: "personal",
      allowPersonal: true,
    });

    cookieStore.get.mockReturnValue({ value: "junk" });
    prisma.user.findUnique.mockResolvedValue({ preferences: { scope: "all" } });
    expect(await getWorkspaceScope()).toEqual({
      scope: "all",
      allowPersonal: true,
    });

    prisma.user.findUnique.mockResolvedValue({ preferences: null });
    expect(await getWorkspaceScope()).toEqual({
      scope: "workspace",
      allowPersonal: true,
    });
  });

  it("forces workspace when personal subscriptions are disabled", async () => {
    getSetting.mockResolvedValue(false);
    cookieStore.get.mockReturnValue({ value: "personal" });
    expect(await getWorkspaceScope()).toEqual({
      scope: "workspace",
      allowPersonal: false,
    });
  });

  it("persists the scope in cookie and preferences", async () => {
    prisma.user.findUnique.mockResolvedValue({
      preferences: { theme: "dark" },
    });
    const result = await setWorkspaceScope("personal");
    expect(result).toEqual({
      success: true,
      data: { scope: "personal", allowPersonal: true },
    });
    expect(cookieStore.set).toHaveBeenCalledWith(
      "subhub_scope",
      "personal",
      expect.objectContaining({ path: "/" })
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { preferences: { theme: "dark", scope: "personal" } },
    });
  });

  it("rejects invalid scopes and downgrades personal when disallowed", async () => {
    expect((await setWorkspaceScope("galaxy")).success).toBe(false);
    getSetting.mockResolvedValue(false);
    const result = await setWorkspaceScope("personal");
    expect(result.data?.scope).toBe("workspace");
  });
});
