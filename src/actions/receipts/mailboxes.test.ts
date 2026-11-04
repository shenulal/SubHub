// src/actions/receipts/mailboxes.test.ts
import { prisma } from "@/lib/db";
import { ForbiddenError, requirePermission } from "@/lib/rbac/service";
import { getProvider } from "@/lib/services/receipts/providers";
import { scanMailbox } from "@/lib/services/receipts/scanner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { disconnectMailbox, getMailboxes, scanMailboxNow } from "./mailboxes";

vi.mock("@/lib/db", () => ({
  prisma: {
    mailboxConnection: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    receiptSuggestion: { groupBy: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/rbac/service", () => {
  class ForbiddenError extends Error {
    constructor(public readonly permission: string | string[]) {
      super("You do not have permission to perform this action");
      this.name = "ForbiddenError";
    }
  }
  return {
    ForbiddenError,
    isForbiddenError: (e: unknown) => e instanceof ForbiddenError,
    requirePermission: vi.fn(),
  };
});
vi.mock("@/lib/services/receipts/providers", () => ({ getProvider: vi.fn() }));
vi.mock("@/lib/services/receipts/scanner", () => ({ scanMailbox: vi.fn() }));
vi.mock("@/lib/crypto", () => ({
  decrypt: (v: string) => `dec:${v}`,
  encrypt: (v: string) => v,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const db = prisma as unknown as Record<
  string,
  Record<string, ReturnType<typeof vi.fn>>
>;
const mockedRequire = requirePermission as unknown as ReturnType<typeof vi.fn>;
const mockedScan = scanMailbox as unknown as ReturnType<typeof vi.fn>;
const mockedGetProvider = getProvider as unknown as ReturnType<typeof vi.fn>;

function grant(keys: string[]) {
  mockedRequire.mockImplementation(
    async (permission: string | string[], options?: { mode?: string }) => {
      const list = Array.isArray(permission) ? permission : [permission];
      const ok =
        (options?.mode ?? "all") === "all"
          ? list.every((k) => keys.includes(k))
          : list.some((k) => keys.includes(k));
      if (!ok) throw new ForbiddenError(permission);
      return {
        userId: "user-1",
        organizationId: "org-1",
        role: "MEMBER",
        permissions: new Set(keys),
      };
    }
  );
}

const row = {
  id: "mb-1",
  userId: "user-1",
  organizationId: "org-1",
  provider: "GMAIL",
  email: "me@acme.com",
  status: "ACTIVE",
  accessToken: "enc-a",
  refreshToken: "enc-r",
  expiresAt: null,
  lastScannedAt: new Date("2026-01-01T00:00:00Z"),
  errorMessage: null,
  createdAt: new Date("2025-12-01T00:00:00Z"),
  user: { name: "Me", email: "me@acme.com" },
  _count: { suggestions: 5 },
};

describe("mailbox actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.mailboxConnection.findMany.mockResolvedValue([
      row,
      { ...row, id: "mb-2", userId: "user-2" },
    ]);
    db.receiptSuggestion.groupBy.mockResolvedValue([
      { mailboxId: "mb-1", _count: { _all: 3 } },
    ]);
    db.mailboxConnection.findFirst.mockResolvedValue(row);
    db.mailboxConnection.delete.mockResolvedValue({});
    db.auditLog.create.mockResolvedValue({});
    mockedGetProvider.mockReturnValue({
      revoke: vi.fn().mockResolvedValue(undefined),
    });
    mockedScan.mockResolvedValue({
      connectionId: "mb-1",
      fetched: 3,
      created: 1,
    });
  });

  it("lists mailboxes with suggestion counters, scoped to the caller", async () => {
    grant(["mailboxes:connect_own"]);
    const result = await getMailboxes();
    expect(db.mailboxConnection.findMany.mock.calls[0][0].where).toEqual({
      organizationId: "org-1",
      userId: "user-1",
    });
    expect(result.data?.[0]).toMatchObject({
      id: "mb-1",
      suggestionCount: 5,
      newSuggestionCount: 3,
      isOwn: true,
      ownerEmail: "me@acme.com",
      lastScannedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.data?.[1]).toMatchObject({
      id: "mb-2",
      newSuggestionCount: 0,
      isOwn: false,
    });
  });

  it("lists every organisation mailbox for mailboxes:manage", async () => {
    grant(["mailboxes:manage"]);
    await getMailboxes();
    expect(db.mailboxConnection.findMany.mock.calls[0][0].where).toEqual({
      organizationId: "org-1",
    });
  });

  it("rejects callers without any mailbox permission", async () => {
    grant([]);
    expect(await getMailboxes()).toMatchObject({
      success: false,
      error: expect.stringMatching(/permission/),
    });
  });

  it("disconnects: revokes best-effort, deletes and audits", async () => {
    grant(["mailboxes:connect_own"]);
    const provider = {
      revoke: vi.fn().mockRejectedValue(new Error("offline")),
    };
    mockedGetProvider.mockReturnValue(provider);

    const result = await disconnectMailbox("mb-1");

    expect(result.success).toBe(true);
    expect(db.mailboxConnection.findFirst).toHaveBeenCalledWith({
      where: { id: "mb-1", organizationId: "org-1", userId: "user-1" },
    });
    expect(provider.revoke).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "dec:enc-a",
        refreshToken: "dec:enc-r",
      })
    );
    expect(db.mailboxConnection.delete).toHaveBeenCalledWith({
      where: { id: "mb-1" },
    });
    expect(db.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: "DISCONNECT_MAILBOX",
      entityId: "mb-1",
    });
  });

  it("refuses to disconnect a mailbox outside the caller's scope", async () => {
    grant(["mailboxes:connect_own"]);
    db.mailboxConnection.findFirst.mockResolvedValue(null);
    expect(await disconnectMailbox("mb-2")).toMatchObject({
      success: false,
      error: "Mailbox not found",
    });
    expect(db.mailboxConnection.delete).not.toHaveBeenCalled();
    expect((await disconnectMailbox("")).success).toBe(false);
  });

  it("runs a manual scan and reports provider failures", async () => {
    grant(["mailboxes:manage"]);
    const ok = await scanMailboxNow("mb-1");
    expect(ok).toMatchObject({ success: true, data: { fetched: 3 } });
    expect(mockedScan).toHaveBeenCalledWith("mb-1");
    expect(db.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: "SCAN_MAILBOX",
    });

    mockedScan.mockResolvedValue({
      connectionId: "mb-1",
      fetched: 0,
      created: 0,
      error: "quota",
    });
    expect(await scanMailboxNow("mb-1")).toMatchObject({
      success: false,
      error: "quota",
    });
  });
});
