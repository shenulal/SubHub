// src/actions/discovery/test-helpers.ts
/**
 * Shared vitest fixtures for discovery actions. Not a test file itself.
 */
import { vi } from "vitest";

export const ORG = "org-1";
export const USER = "user-1";

export function permissionResult(keys: string[]) {
  return {
    userId: USER,
    organizationId: ORG,
    role: "ADMIN",
    permissions: new Set(keys),
  };
}

export const ALL_READ = [
  "subscriptions:read",
  "subscriptions:read_all",
  "subscriptions:export",
  "subscriptions:bulk",
  "approvals:read",
  "approvals:read_all",
  "members:read",
  "reports:read",
  "reports:export",
];

export function mockPrisma() {
  return {
    subscription: { findMany: vi.fn(), count: vi.fn() },
    savedView: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    approvalRequest: { findMany: vi.fn() },
    saaSCatalog: { findMany: vi.fn() },
    category: { findMany: vi.fn() },
    tag: { findMany: vi.fn() },
    team: { findMany: vi.fn() },
    costCenter: { findMany: vi.fn() },
    paymentMethodOption: { findMany: vi.fn() },
    billingCycleConfig: { findMany: vi.fn() },
  };
}

export class FakeForbidden extends Error {
  constructor(public readonly permission: string) {
    super("You do not have permission to perform this action");
    this.name = "ForbiddenError";
  }
}
