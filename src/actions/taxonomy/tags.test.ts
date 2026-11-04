import { beforeEach, describe, expect, it, vi } from "vitest";

import { MockForbiddenError, deny, grant } from "./test-utils";

vi.mock("@/lib/db", () => ({
  prisma: {
    tag: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    subscriptionTag: { findMany: vi.fn(), createMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/rbac/service", () => ({
  ForbiddenError: MockForbiddenError,
  isForbiddenError: (e: unknown) => e instanceof MockForbiddenError,
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/logging", () => ({
  withLogging: (_n: string, fn: unknown) => fn,
}));

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/service";

import {
  deleteTag,
  ensureTags,
  listTags,
  mergeTags,
  renameTag,
  searchTags,
  setTagColor,
} from "./tags";

const rp = vi.mocked(requirePermission);
const db = prisma as unknown as {
  tag: Record<string, ReturnType<typeof vi.fn>>;
  subscriptionTag: Record<string, ReturnType<typeof vi.fn>>;
  auditLog: { create: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)
  );
});

describe("reads", () => {
  it("lists tags with usage counts", async () => {
    grant(rp);
    db.tag.findMany.mockResolvedValue([
      { id: "t1", name: "ops", color: null, _count: { subscriptions: 3 } },
    ]);
    expect(await listTags()).toEqual([
      { id: "t1", name: "ops", color: null, usageCount: 3 },
    ]);
  });
  it("searches case-insensitively with a clamped limit", async () => {
    grant(rp);
    db.tag.findMany.mockResolvedValue([]);
    await searchTags("  Op ", 500);
    expect(db.tag.findMany.mock.calls[0][0]).toMatchObject({
      where: {
        organizationId: "org-1",
        name: { contains: "Op", mode: "insensitive" },
      },
      take: 50,
    });
  });
  it("returns [] when forbidden", async () => {
    deny(rp);
    expect(await searchTags("x")).toEqual([]);
  });
});

describe("ensureTags", () => {
  it("trims, de-duplicates case-insensitively, reuses existing and creates missing in input order", async () => {
    grant(rp);
    db.tag.findMany.mockResolvedValue([
      { id: "t1", name: "Ops", color: "#000" },
    ]);
    db.tag.create.mockImplementation(
      async ({ data }: { data: { name: string } }) => ({
        id: `new-${data.name}`,
        name: data.name,
        color: null,
      })
    );
    const result = await ensureTags([" ops ", "Finance", "finance", "", "Ops"]);
    expect(result.map((t) => t.name)).toEqual(["Ops", "Finance"]);
    expect(db.tag.create).toHaveBeenCalledTimes(1);
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
  });
  it("returns [] without touching permissions for empty input", async () => {
    expect(await ensureTags(["", "  "])).toEqual([]);
    expect(rp).not.toHaveBeenCalled();
  });
  it("throws on forbidden so callers can surface the error", async () => {
    deny(rp);
    await expect(ensureTags(["x"])).rejects.toBeInstanceOf(MockForbiddenError);
  });
});

describe("mergeTags", () => {
  it("re-links subscriptions to the target, deletes sources and audits", async () => {
    grant(rp);
    db.tag.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "t" }]);
    db.subscriptionTag.findMany.mockResolvedValue([
      { subscriptionId: "s1" },
      { subscriptionId: "s1" },
      { subscriptionId: "s2" },
    ]);
    const result = await mergeTags(["a", "b", "t"], "t");
    expect(result).toMatchObject({ success: true, data: { moved: 2 } });
    expect(db.subscriptionTag.createMany).toHaveBeenCalledWith({
      data: [
        { subscriptionId: "s1", tagId: "t" },
        { subscriptionId: "s2", tagId: "t" },
      ],
      skipDuplicates: true,
    });
    expect(db.tag.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["a", "b"] }, organizationId: "org-1" },
    });
    expect(db.auditLog.create.mock.calls[0][0].data.action).toBe("MERGE_TAGS");
  });
  it("fails when only the target is selected or a tag is foreign", async () => {
    grant(rp);
    expect((await mergeTags(["t"], "t")).success).toBe(false);
    db.tag.findMany.mockResolvedValue([{ id: "t" }]);
    expect((await mergeTags(["a"], "t")).error).toMatch(/not found/);
  });
});

describe("rename / colour / delete", () => {
  it("prevents renaming to an existing name (case-insensitive)", async () => {
    grant(rp);
    db.tag.findFirst
      .mockResolvedValueOnce({ id: "a", name: "ops" })
      .mockResolvedValueOnce({ id: "b", name: "OPS2" });
    expect((await renameTag("a", "ops2")).error).toMatch(/already exists/);
  });
  it("renames and audits", async () => {
    grant(rp);
    db.tag.findFirst
      .mockResolvedValueOnce({ id: "a", name: "ops" })
      .mockResolvedValueOnce(null);
    db.tag.update.mockResolvedValue({ id: "a", name: "Ops", color: null });
    expect((await renameTag("a", "Ops")).data?.name).toBe("Ops");
    expect(db.auditLog.create.mock.calls[0][0].data.action).toBe("RENAME_TAG");
  });
  it("validates colours", async () => {
    grant(rp);
    expect((await setTagColor("a", "blue")).success).toBe(false);
  });
  it("deletes owned tags only", async () => {
    grant(rp);
    db.tag.findFirst.mockResolvedValueOnce(null);
    expect((await deleteTag("x")).success).toBe(false);
    db.tag.findFirst.mockResolvedValueOnce({ id: "a", name: "ops" });
    expect((await deleteTag("a")).success).toBe(true);
    expect(db.tag.delete).toHaveBeenCalledWith({ where: { id: "a" } });
  });
});
