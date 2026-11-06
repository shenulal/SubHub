// src/providers/access-control-provider.test.ts
import {
  SYSTEM_ROLE_TEMPLATES,
  type SystemRoleKey,
} from "@/lib/rbac/permissions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  accessControlProvider,
  normalizeResource,
  requiredPermission,
  resetPermissionCache,
  RESOURCE_PERMISSIONS,
} from "./access-control-provider";

const grants = (role: SystemRoleKey) => [...SYSTEM_ROLE_TEMPLATES[role].grants];

async function check(
  role: SystemRoleKey | string[],
  resource: string | undefined,
  action: string
) {
  const permissions = Array.isArray(role) ? role : grants(role);
  const result = await accessControlProvider.can({
    resource,
    action,
    params: { permissions },
  });
  return result.can;
}

describe("accessControlProvider", () => {
  beforeEach(() => resetPermissionCache());
  afterEach(() => vi.unstubAllGlobals());

  it("maps every resource action to a catalogue permission", () => {
    for (const actions of Object.values(RESOURCE_PERMISSIONS)) {
      for (const key of Object.values(actions)) {
        expect(key).toMatch(/^[a-z_]+:[a-z_]+$/);
      }
    }
  });

  it("normalises singular and camelCase resource names", () => {
    expect(normalizeResource("app")).toBe("apps");
    expect(normalizeResource("approvalRequests")).toBe("approvals");
    expect(normalizeResource("unknown")).toBeNull();
    expect(normalizeResource(undefined)).toBeNull();
    expect(requiredPermission("approval", "approve")).toBe("approvals:decide");
  });

  it("lets an admin manage apps, integrations and members", async () => {
    expect(await check("ADMIN", "apps", "delete")).toBe(true);
    expect(await check("ADMIN", "integrations", "sync")).toBe(true);
    expect(await check("ADMIN", "users", "invite")).toBe(true);
  });

  it("lets an approver approve but not delete apps or integrations", async () => {
    expect(await check("APPROVER", "approvals", "approve")).toBe(true);
    expect(await check("APPROVER", "apps", "delete")).toBe(false);
    expect(await check("APPROVER", "integrations", "create")).toBe(false);
    expect(await check("APPROVER", "payments", "list")).toBe(true);
  });

  it("lets a member create subscriptions and requests but not approve", async () => {
    expect(await check("MEMBER", "subscriptions", "create")).toBe(true);
    expect(await check("MEMBER", "approvals", "create")).toBe(true);
    expect(await check("MEMBER", "approvals", "approve")).toBe(false);
    expect(await check("MEMBER", "users", "delete")).toBe(false);
    expect(await check("MEMBER", "payments", "list")).toBe(false);
  });

  it("keeps a viewer read-only", async () => {
    expect(await check("VIEWER", "subscriptions", "list")).toBe(true);
    expect(await check("VIEWER", "subscriptions", "create")).toBe(false);
    expect(await check("VIEWER", "tags", "create")).toBe(false);
    expect(await check("VIEWER", "audit-logs", "list")).toBe(false);
  });

  it("honours a custom role's grants instead of its legacy role", async () => {
    expect(await check(["apps:read", "apps:manage"], "apps", "delete")).toBe(
      true
    );
    expect(await check(["apps:read"], "apps", "delete")).toBe(false);
  });

  it("allows unmapped reads and only lets settings managers write", async () => {
    expect(await check(["subscriptions:read"], "widgets", "list")).toBe(true);
    expect(await check(["subscriptions:read"], "widgets", "edit")).toBe(false);
    expect(await check(["settings:manage"], undefined, "edit")).toBe(true);
  });

  it("denies when the permission set is empty", async () => {
    expect(await check([], "apps", "list")).toBe(false);
  });

  it("loads and caches the session's permissions from the API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { permissions: ["apps:read"] } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const a = await accessControlProvider.can({
      resource: "apps",
      action: "list",
    });
    const b = await accessControlProvider.can({
      resource: "apps",
      action: "edit",
    });
    expect(a.can).toBe(true);
    expect(b.can).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/me/permissions", {
      credentials: "include",
    });
  });

  it("denies when the permissions endpoint fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const result = await accessControlProvider.can({
      resource: "apps",
      action: "list",
    });
    expect(result.can).toBe(false);
  });

  it("denies when the permissions request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await accessControlProvider.can({
      resource: "apps",
      action: "list",
    });
    expect(result.can).toBe(false);
  });
});
