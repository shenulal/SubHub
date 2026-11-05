import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  accessControlProvider,
  normalizeResource,
  PERMISSION_MATRIX,
  resetRoleCache,
} from "./access-control-provider";

describe("accessControlProvider", () => {
  beforeEach(() => {
    resetRoleCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("default behaviour (no resource)", () => {
    it("allows ADMIN every action", async () => {
      const result = await accessControlProvider.can({
        action: "delete",
        params: { user: { role: "ADMIN" } },
      });
      expect(result.can).toBe(true);
    });

    it("allows VIEWER read-only access", async () => {
      const allow = await accessControlProvider.can({
        action: "list",
        params: { user: { role: "VIEWER" } },
      });
      const deny = await accessControlProvider.can({
        action: "delete",
        params: { user: { role: "VIEWER" } },
      });

      expect(allow.can).toBe(true);
      expect(deny.can).toBe(false);
    });

    it("forbids MEMBER from deleting", async () => {
      const deleteResult = await accessControlProvider.can({
        action: "delete",
        params: { user: { role: "MEMBER" } },
      });
      expect(deleteResult.can).toBe(false);
    });

    it("denies when not logged in", async () => {
      const result = await accessControlProvider.can({
        action: "list",
        params: {},
      });
      expect(result.can).toBe(false);
    });
  });

  describe("per-resource permission checks - ADMIN", () => {
    const role = "ADMIN";

    it("apps: allows full CRUD", async () => {
      for (const action of ["list", "show", "create", "edit", "delete"]) {
        const result = await accessControlProvider.can({
          action,
          resource: "apps",
          params: { user: { role } },
        });
        expect(result.can, `${action} failed`).toBe(true);
      }
    });

    it("users: includes invite permission", async () => {
      const result = await accessControlProvider.can({
        action: "invite",
        resource: "users",
        params: { user: { role } },
      });
      expect(result.can).toBe(true);
    });

    it("integrations: includes sync permission", async () => {
      const result = await accessControlProvider.can({
        action: "sync",
        resource: "integrations",
        params: { user: { role } },
      });
      expect(result.can).toBe(true);
    });

    it("payments: full access", async () => {
      const result = await accessControlProvider.can({
        action: "create",
        resource: "payments",
        params: { user: { role } },
      });
      expect(result.can).toBe(true);
    });
  });

  describe("per-resource permission checks - MEMBER", () => {
    const role = "MEMBER";

    it("apps: allows read+create only, no edit/delete", async () => {
      // Allowed
      for (const action of ["list", "show", "create"]) {
        const result = await accessControlProvider.can({
          action,
          resource: "apps",
          params: { user: { role } },
        });
        expect(result.can, `${action} allow failed`).toBe(true);
      }

      // Denied
      for (const action of ["edit", "delete"]) {
        const result = await accessControlProvider.can({
          action,
          resource: "apps",
          params: { user: { role } },
        });
        expect(result.can, `${action} deny failed`).toBe(false);
      }
    });

    it("users: allows read only, no create/edit/delete/invite", async () => {
      // Allowed
      for (const action of ["list", "show"]) {
        const result = await accessControlProvider.can({
          action,
          resource: "users",
          params: { user: { role } },
        });
        expect(result.can, `${action} allow failed`).toBe(true);
      }

      // Denied
      for (const action of ["create", "edit", "delete", "invite"]) {
        const result = await accessControlProvider.can({
          action,
          resource: "users",
          params: { user: { role } },
        });
        expect(result.can, `${action} deny failed`).toBe(false);
      }
    });

    it("integrations: cannot sync", async () => {
      const result = await accessControlProvider.can({
        action: "sync",
        resource: "integrations",
        params: { user: { role } },
      });
      expect(result.can).toBe(false);
    });

    it("payments: allows read only", async () => {
      const allowList = await accessControlProvider.can({
        action: "list",
        resource: "payments",
        params: { user: { role } },
      });
      const denyCreate = await accessControlProvider.can({
        action: "create",
        resource: "payments",
        params: { user: { role } },
      });

      expect(allowList.can).toBe(true);
      expect(denyCreate.can).toBe(false);
    });
  });

  describe("per-resource permission checks - VIEWER", () => {
    const role = "VIEWER";

    it("apps: allows read only", async () => {
      // Allowed
      for (const action of ["list", "show"]) {
        const result = await accessControlProvider.can({
          action,
          resource: "apps",
          params: { user: { role } },
        });
        expect(result.can, `${action} allow failed`).toBe(true);
      }

      // Denied
      for (const action of ["create", "edit", "delete"]) {
        const result = await accessControlProvider.can({
          action,
          resource: "apps",
          params: { user: { role } },
        });
        expect(result.can, `${action} deny failed`).toBe(false);
      }
    });

    it("payments: no access at all", async () => {
      for (const action of ["list", "show", "create", "edit", "delete"]) {
        const result = await accessControlProvider.can({
          action,
          resource: "payments",
          params: { user: { role } },
        });
        expect(result.can, `${action} deny failed`).toBe(false);
      }
    });

    it("audit-logs: no access at all", async () => {
      for (const action of ["list", "show"]) {
        const result = await accessControlProvider.can({
          action,
          resource: "audit-logs",
          params: { user: { role } },
        });
        expect(result.can, `${action} deny failed`).toBe(false);
      }
    });
  });

  describe("normalizeResource", () => {
    it("returns an exactly matching resource name", () => {
      expect(normalizeResource("apps")).toBe("apps");
      expect(normalizeResource("subscriptions")).toBe("subscriptions");
      expect(normalizeResource("audit-logs")).toBe("audit-logs");
    });

    it("converts singular to plural", () => {
      expect(normalizeResource("app")).toBe("apps");
      expect(normalizeResource("subscription")).toBe("subscriptions");
      expect(normalizeResource("user")).toBe("users");
    });

    it("handles the auditLogs variant", () => {
      expect(normalizeResource("auditLogs")).toBe("audit-logs");
      expect(normalizeResource("auditLog")).toBe("audit-logs");
    });

    it("returns null for an unknown resource", () => {
      expect(normalizeResource("unknown")).toBe(null);
      expect(normalizeResource(undefined)).toBe(null);
    });
  });

  describe("PERMISSION_MATRIX validation", () => {
    it("ADMIN has list/show on every resource", () => {
      for (const resource of Object.keys(PERMISSION_MATRIX.ADMIN)) {
        const actions =
          PERMISSION_MATRIX.ADMIN[
            resource as keyof typeof PERMISSION_MATRIX.ADMIN
          ];
        expect(actions).toContain("list");
        expect(actions).toContain("show");
      }
    });

    it("VIEWER payments is an empty array", () => {
      expect(PERMISSION_MATRIX.VIEWER.payments).toEqual([]);
    });

    it("VIEWER audit-logs is an empty array", () => {
      expect(PERMISSION_MATRIX.VIEWER["audit-logs"]).toEqual([]);
    });

    it("MEMBER has create on apps", () => {
      expect(PERMISSION_MATRIX.MEMBER.apps).toContain("create");
    });

    it("MEMBER has no create on users", () => {
      expect(PERMISSION_MATRIX.MEMBER.users).not.toContain("create");
    });
  });

  describe("error messages", () => {
    it("returns an appropriate reason when permission is denied", async () => {
      const result = await accessControlProvider.can({
        action: "delete",
        resource: "apps",
        params: { user: { role: "VIEWER" } },
      });

      expect(result.can).toBe(false);
      expect(result.reason).toBe("You do not have delete permission for apps.");
    });

    it("returns an appropriate message when payments access is denied", async () => {
      const result = await accessControlProvider.can({
        action: "list",
        resource: "payments",
        params: { user: { role: "VIEWER" } },
      });

      expect(result.can).toBe(false);
      expect(result.reason).toBe(
        "You do not have list permission for payments."
      );
    });
  });

  describe("session fallback (when params.user.role is missing)", () => {
    it("allows access using the ADMIN role from the session", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { role: "ADMIN" } }), {
          status: 200,
        })
      );

      const result = await accessControlProvider.can({
        action: "delete",
        resource: "users",
        params: {},
      });

      expect(result.can).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/session", {
        credentials: "include",
      });
    });

    it("denies delete when the session role is MEMBER", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { role: "MEMBER" } }), {
          status: 200,
        })
      );

      const result = await accessControlProvider.can({
        action: "delete",
        resource: "apps",
        params: {},
      });

      expect(result.can).toBe(false);
    });

    it("denies create when the session role is VIEWER", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { role: "VIEWER" } }), {
          status: 200,
        })
      );

      const result = await accessControlProvider.can({
        action: "create",
        resource: "apps",
        params: {},
      });

      expect(result.can).toBe(false);
    });

    it("denies when the session lookup fails", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(null, { status: 401 })
      );

      const result = await accessControlProvider.can({
        action: "list",
        resource: "apps",
        params: {},
      });

      expect(result.can).toBe(false);
      expect(result.reason).toBe("Permission denied.");
    });

    it("denies on a network error", async () => {
      vi.spyOn(global, "fetch").mockRejectedValueOnce(
        new Error("Network error")
      );

      const result = await accessControlProvider.can({
        action: "list",
        resource: "apps",
        params: {},
      });

      expect(result.can).toBe(false);
    });

    it("looks up the role from the session when params is undefined", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { role: "ADMIN" } }), {
          status: 200,
        })
      );

      const result = await accessControlProvider.can({
        action: "delete",
        resource: "apps",
      });

      expect(result.can).toBe(true);
    });
  });

  describe("session cache", () => {
    it("reuses the cached role instead of calling fetch again", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ user: { role: "ADMIN" } }), {
          status: 200,
        })
      );

      // First call - runs fetch
      await accessControlProvider.can({
        action: "delete",
        resource: "apps",
        params: {},
      });

      // Second call - uses the cache
      const result = await accessControlProvider.can({
        action: "delete",
        resource: "users",
        params: {},
      });

      expect(result.can).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("does not call fetch when params.user.role is present", async () => {
      const fetchSpy = vi.spyOn(global, "fetch");

      await accessControlProvider.can({
        action: "delete",
        resource: "apps",
        params: { user: { role: "ADMIN" } },
      });

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("calls fetch again after resetRoleCache", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ user: { role: "ADMIN" } }), {
          status: 200,
        })
      );

      // First call
      await accessControlProvider.can({
        action: "list",
        resource: "apps",
        params: {},
      });

      resetRoleCache();

      // Second call after resetting the cache
      await accessControlProvider.can({
        action: "list",
        resource: "apps",
        params: {},
      });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
