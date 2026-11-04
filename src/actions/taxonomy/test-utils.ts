// src/actions/taxonomy/test-utils.ts
/** Shared mock factories for taxonomy action tests (not shipped). */
import { vi } from "vitest";

export class MockForbiddenError extends Error {
  constructor(public readonly permission: string | string[]) {
    super("forbidden");
    this.name = "ForbiddenError";
  }
}

export const ORG = "org-1";
export const USER = "user-1";

export function grant(requirePermission: ReturnType<typeof vi.fn>) {
  requirePermission.mockResolvedValue({
    organizationId: ORG,
    userId: USER,
    role: "ADMIN",
    permissions: new Set(),
  });
}

export function deny(requirePermission: ReturnType<typeof vi.fn>) {
  requirePermission.mockRejectedValue(new MockForbiddenError("x"));
}
