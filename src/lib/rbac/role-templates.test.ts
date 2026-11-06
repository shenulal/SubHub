// src/lib/rbac/role-templates.test.ts
/**
 * Regression guard for the system role templates (docs/RBAC-MATRIX.md).
 * If a capability below changes on purpose, update the matrix and add the key
 * to PERMISSION_ROLLOUTS so existing organisations are re-synced.
 */
import { describe, expect, it } from "vitest";
import {
  PERMISSION_KEYS,
  PERMISSION_ROLLOUTS,
  SYSTEM_ROLE_TEMPLATES,
  type PermissionKey,
  type SystemRoleKey,
} from "./permissions";

const has = (role: SystemRoleKey, key: PermissionKey) =>
  SYSTEM_ROLE_TEMPLATES[role].grants.includes(key);

const WRITE_ACTIONS =
  /:(create|update|delete|bulk|manage|manage_[a-z_]+|invite|decide|cancel_any|upload|assign|connect_own|export|export_org)$/;

describe("system role templates", () => {
  it("grants the administrator every permission", () => {
    expect(new Set(SYSTEM_ROLE_TEMPLATES.ADMIN.grants)).toEqual(
      new Set(PERMISSION_KEYS)
    );
  });

  it("lets an approver decide approvals and read every subscription", () => {
    for (const key of [
      "approvals:decide",
      "approvals:read_all",
      "subscriptions:read",
      "subscriptions:read_all",
      "approvals:create",
      "payments:read",
      "audit:read_all",
    ] as const) {
      expect(has("APPROVER", key), key).toBe(true);
    }
  });

  it("keeps organisation administration away from approvers", () => {
    for (const key of [
      "settings:manage",
      "roles:manage",
      "members:manage",
      "members:invite",
      "organization:manage",
      "approval_policies:manage",
      "apps:manage",
      "subscriptions:delete",
      "subscriptions:assign",
      "integrations:manage",
      "payments:manage",
      "extensions:read",
    ] as const) {
      expect(has("APPROVER", key), key).toBe(false);
    }
  });

  it("lets a member submit requests and manage subscriptions", () => {
    for (const key of [
      "approvals:create",
      "approvals:read",
      "subscriptions:read",
      "subscriptions:create",
      "subscriptions:update",
      "comments:create",
      "attachments:upload",
      "notifications:manage_own",
      "data:export_own",
    ] as const) {
      expect(has("MEMBER", key), key).toBe(true);
    }
  });

  it("does not let a member decide, administer or see finance data", () => {
    for (const key of [
      "approvals:decide",
      "approvals:read_all",
      "settings:manage",
      "roles:manage",
      "members:manage",
      "members:invite",
      "subscriptions:delete",
      "subscriptions:read_all",
      "subscriptions:assign",
      "payments:read",
      "audit:read_all",
      "extensions:read",
    ] as const) {
      expect(has("MEMBER", key), key).toBe(false);
    }
  });

  it("keeps the viewer read-only (own preferences and own data aside)", () => {
    const selfService = new Set<string>([
      "notifications:manage_own",
      "data:export_own",
      "data:delete_own",
    ]);
    const writes = SYSTEM_ROLE_TEMPLATES.VIEWER.grants.filter(
      (key) => WRITE_ACTIONS.test(key) && !selfService.has(key)
    );
    expect(writes).toEqual([]);
    expect(has("VIEWER", "subscriptions:create")).toBe(false);
    expect(has("VIEWER", "approvals:create")).toBe(false);
    expect(has("VIEWER", "tags:create")).toBe(false);
    expect(has("VIEWER", "subscriptions:read")).toBe(true);
  });

  it("orders the roles by privilege (viewer ⊂ member ⊂ approver ⊂ admin)", () => {
    const chain: SystemRoleKey[] = ["VIEWER", "MEMBER", "APPROVER", "ADMIN"];
    for (let i = 1; i < chain.length; i++) {
      const lower = SYSTEM_ROLE_TEMPLATES[chain[i - 1]].grants;
      const upper = new Set(SYSTEM_ROLE_TEMPLATES[chain[i]].grants);
      expect(
        lower.filter((key) => !upper.has(key)),
        `${chain[i - 1]} ⊂ ${chain[i]}`
      ).toEqual([]);
    }
  });

  it("only rolls out catalogue keys", () => {
    for (const key of PERMISSION_ROLLOUTS) {
      expect(PERMISSION_KEYS).toContain(key);
    }
  });
});
