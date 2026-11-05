// src/lib/ai/pending-action-store.test.ts
// SMP-204: Pending Action Store unit tests

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearStore,
  getStoreSize,
  hashParams,
  storePendingAction,
  validateAndConsume,
} from "./pending-action-store";

describe("pending-action-store", () => {
  beforeEach(() => {
    clearStore();
    vi.restoreAllMocks();
  });

  describe("hashParams", () => {
    it("returns the same hash for identical params", () => {
      const params = { appId: "app-1", action: "create_app", name: "Test" };
      expect(hashParams(params)).toBe(hashParams(params));
    });

    it("returns the same hash regardless of key order", () => {
      const a = { name: "Test", action: "create_app" };
      const b = { action: "create_app", name: "Test" };
      expect(hashParams(a)).toBe(hashParams(b));
    });

    it("returns different hashes for different params", () => {
      const a = { name: "Test" };
      const b = { name: "Other" };
      expect(hashParams(a)).not.toBe(hashParams(b));
    });
  });

  describe("storePendingAction", () => {
    it("saves a pending action", () => {
      storePendingAction(
        "id-1",
        "create_app",
        { name: "Test" },
        "org-1",
        "user-1"
      );
      expect(getStoreSize()).toBe(1);
    });

    it("can save multiple pending actions", () => {
      storePendingAction(
        "id-1",
        "create_app",
        { name: "A" },
        "org-1",
        "user-1"
      );
      storePendingAction("id-2", "delete_app", { id: "B" }, "org-1", "user-1");
      expect(getStoreSize()).toBe(2);
    });
  });

  describe("validateAndConsume", () => {
    it("approves a valid request and removes it from the store", () => {
      const params = { action: "create_app", name: "Test" };
      storePendingAction("id-1", "create_app", params, "org-1", "user-1");

      const result = validateAndConsume("id-1", params, "org-1", "user-1");
      expect(result).toEqual({ valid: true });
      expect(getStoreSize()).toBe(0);
    });

    it("rejects a non-existent ID", () => {
      const result = validateAndConsume("nonexistent", {}, "org-1", "user-1");
      expect(result).toEqual({
        valid: false,
        error: expect.stringContaining("expired or is invalid"),
        status: 400,
      });
    });

    it("rejects an already consumed request (single use)", () => {
      const params = { action: "create_app", name: "Test" };
      storePendingAction("id-1", "create_app", params, "org-1", "user-1");

      // First consumption -> success
      const first = validateAndConsume("id-1", params, "org-1", "user-1");
      expect(first).toEqual({ valid: true });

      // Second consumption -> failure (replay attack prevention)
      const second = validateAndConsume("id-1", params, "org-1", "user-1");
      expect(second).toEqual({
        valid: false,
        error: expect.stringContaining("expired or is invalid"),
        status: 400,
      });
    });

    it("rejects a request past its TTL", () => {
      const params = { action: "create_app", name: "Test" };
      storePendingAction("id-1", "create_app", params, "org-1", "user-1");

      // Advance time by 6 minutes
      vi.spyOn(Date, "now").mockReturnValue(Date.now() + 6 * 60 * 1000);

      const result = validateAndConsume("id-1", params, "org-1", "user-1");
      expect(result).toEqual({
        valid: false,
        error: expect.stringContaining("timed out"),
        status: 400,
      });
    });

    it("rejects a request from another organization", () => {
      const params = { action: "create_app", name: "Test" };
      storePendingAction("id-1", "create_app", params, "org-1", "user-1");

      const result = validateAndConsume("id-1", params, "org-2", "user-1");
      expect(result).toEqual({
        valid: false,
        error: expect.stringContaining("Permission denied"),
        status: 403,
      });
    });

    it("rejects a request from another user", () => {
      const params = { action: "create_app", name: "Test" };
      storePendingAction("id-1", "create_app", params, "org-1", "user-1");

      const result = validateAndConsume("id-1", params, "org-1", "user-2");
      expect(result).toEqual({
        valid: false,
        error: expect.stringContaining("Permission denied"),
        status: 403,
      });
    });

    it("rejects tampered params", () => {
      const original = { action: "create_app", name: "Test" };
      storePendingAction("id-1", "create_app", original, "org-1", "user-1");

      const tampered = { action: "delete_app", id: "victim-app" };
      const result = validateAndConsume("id-1", tampered, "org-1", "user-1");
      expect(result).toEqual({
        valid: false,
        error: expect.stringContaining("tampered"),
        status: 400,
      });
    });
  });

  describe("clearStore", () => {
    it("clears the store", () => {
      storePendingAction("id-1", "create_app", {}, "org-1", "user-1");
      storePendingAction("id-2", "delete_app", {}, "org-1", "user-1");
      expect(getStoreSize()).toBe(2);

      clearStore();
      expect(getStoreSize()).toBe(0);
    });
  });
});
