import { beforeEach, describe, expect, it, vi } from "vitest";

import { MockForbiddenError, deny, grant } from "./test-utils";

vi.mock("@/lib/db", () => ({
  prisma: {
    customFieldDefinition: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/rbac/service", () => ({
  ForbiddenError: MockForbiddenError,
  isForbiddenError: (e: unknown) => e instanceof MockForbiddenError,
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/settings/service", () => ({ getSetting: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/logging", () => ({
  withLogging: (_n: string, fn: unknown) => fn,
}));

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/service";
import { getSetting } from "@/lib/settings/service";

import {
  archiveCustomField,
  createCustomField,
  getCustomFieldDefinitions,
  restoreCustomField,
  updateCustomField,
  validateCustomFieldValues,
} from "./custom-fields";

const rp = vi.mocked(requirePermission);
const gs = vi.mocked(getSetting);
const db = prisma as unknown as {
  customFieldDefinition: Record<string, ReturnType<typeof vi.fn>>;
  auditLog: { create: ReturnType<typeof vi.fn> };
};

const def = (over: Record<string, unknown>) => ({
  id: "f1",
  key: "owner",
  label: "Owner",
  fieldType: "TEXT",
  options: null,
  isRequired: false,
  sortOrder: 0,
  isArchived: false,
  _count: { values: 2 },
  ...over,
});

beforeEach(() => vi.resetAllMocks());

describe("getCustomFieldDefinitions", () => {
  it("maps rows to DTOs with string options only", async () => {
    grant(rp);
    db.customFieldDefinition.findMany.mockResolvedValue([
      def({ fieldType: "SELECT", options: ["A", 1, "B"] }),
    ]);
    const [dto] = await getCustomFieldDefinitions();
    expect(dto).toMatchObject({
      id: "f1",
      fieldType: "SELECT",
      options: ["A", "B"],
      usageCount: 2,
    });
  });
  it("returns [] when forbidden", async () => {
    deny(rp);
    expect(await getCustomFieldDefinitions()).toEqual([]);
  });
});

describe("validateCustomFieldValues (action)", () => {
  it("validates against the org's active definitions", async () => {
    grant(rp);
    db.customFieldDefinition.findMany.mockResolvedValue([
      def({ isRequired: true }),
    ]);
    expect(await validateCustomFieldValues({})).toEqual({
      ok: false,
      errors: { f1: "required" },
    });
  });
});

describe("createCustomField", () => {
  it("enforces subscriptions.maxCustomFields", async () => {
    grant(rp);
    gs.mockResolvedValue(1 as never);
    db.customFieldDefinition.findMany.mockResolvedValue([
      { key: "a", isArchived: false, sortOrder: 0 },
      { key: "b", isArchived: true, sortOrder: 1 },
    ]);
    const result = await createCustomField({ label: "New", fieldType: "TEXT" });
    expect(result.error).toMatch(/Limit of 1/);
    expect(db.customFieldDefinition.create).not.toHaveBeenCalled();
  });
  it("derives a unique key, stores options for SELECT and audits", async () => {
    grant(rp);
    gs.mockResolvedValue(5 as never);
    db.customFieldDefinition.findMany.mockResolvedValue([
      { key: "cost_centre", isArchived: false, sortOrder: 2 },
    ]);
    db.customFieldDefinition.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) =>
        def({ id: "new", ...data })
    );
    const result = await createCustomField({
      label: "Cost centre",
      fieldType: "SELECT",
      options: ["A", "B"],
      isRequired: true,
    });
    expect(result.success).toBe(true);
    expect(db.customFieldDefinition.create.mock.calls[0][0].data).toMatchObject(
      {
        key: "cost_centre-2",
        options: ["A", "B"],
        sortOrder: 3,
        isRequired: true,
        organizationId: "org-1",
      }
    );
    expect(db.auditLog.create.mock.calls[0][0].data.action).toBe(
      "CREATE_CUSTOM_FIELD"
    );
  });
  it("requires options for SELECT and validates keys", async () => {
    grant(rp);
    expect(
      (await createCustomField({ label: "X", fieldType: "SELECT" })).errors
        ?.options
    ).toBeTruthy();
    expect(
      (
        await createCustomField({
          label: "X",
          fieldType: "TEXT",
          key: "Bad Key",
        })
      ).errors?.key
    ).toBeTruthy();
  });
});

describe("update / archive / restore", () => {
  it("does not allow emptying SELECT options", async () => {
    grant(rp);
    db.customFieldDefinition.findFirst.mockResolvedValue(
      def({ fieldType: "SELECT", options: ["A"] })
    );
    expect((await updateCustomField("f1", { options: [] })).error).toMatch(
      /at least one option/
    );
  });
  it("updates label and required flag", async () => {
    grant(rp);
    db.customFieldDefinition.findFirst.mockResolvedValue(def({}));
    db.customFieldDefinition.update.mockResolvedValue(
      def({ label: "Owner 2", isRequired: true })
    );
    const result = await updateCustomField("f1", {
      label: "Owner 2",
      isRequired: true,
    });
    expect(result.data).toMatchObject({ label: "Owner 2", isRequired: true });
  });
  it("archives and refuses to restore past the limit", async () => {
    grant(rp);
    db.customFieldDefinition.findFirst.mockResolvedValue(def({}));
    expect((await archiveCustomField("f1")).success).toBe(true);
    expect(db.customFieldDefinition.update).toHaveBeenCalledWith({
      where: { id: "f1" },
      data: { isArchived: true },
    });
    gs.mockResolvedValue(2 as never);
    db.customFieldDefinition.count.mockResolvedValue(2);
    expect((await restoreCustomField("f1")).error).toMatch(/Limit/);
  });
});

describe("reorderCustomFields", () => {
  it("rejects foreign ids and writes sortOrder in a transaction", async () => {
    const { reorderCustomFields } = await import("./custom-fields");
    const tx = (prisma as unknown as { $transaction: ReturnType<typeof vi.fn> })
      .$transaction;
    grant(rp);
    db.customFieldDefinition.findMany.mockResolvedValueOnce([{ id: "a" }]);
    expect((await reorderCustomFields(["a", "b"])).success).toBe(false);
    db.customFieldDefinition.findMany.mockResolvedValueOnce([
      { id: "a" },
      { id: "b" },
    ]);
    db.customFieldDefinition.update.mockImplementation((args: unknown) => args);
    tx.mockResolvedValue([]);
    expect((await reorderCustomFields(["b", "a"])).success).toBe(true);
    expect(db.customFieldDefinition.update).toHaveBeenCalledWith({
      where: { id: "b" },
      data: { sortOrder: 0 },
    });
    expect(db.auditLog.create.mock.calls.at(-1)?.[0].data.action).toBe(
      "REORDER_CUSTOM_FIELDS"
    );
  });
});
