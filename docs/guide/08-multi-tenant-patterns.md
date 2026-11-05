# 08. Multi-Tenant Patterns Guide

This document describes SubHub's multi-tenant architecture and the organizationId-based data isolation pattern.

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Authentication Helper Functions](#2-authentication-helper-functions)
3. [Prisma Query Patterns](#3-prisma-query-patterns)
4. [Role-Based Access Control](#4-role-based-access-control)
5. [Testing Patterns](#5-testing-patterns)
6. [Checklist](#6-checklist)

---

## 1. Core Concepts

### 1.1 What Is Multi-Tenancy?

An architecture in which a single application instance serves multiple organisations (tenants) simultaneously.

```
┌─────────────────────────────────────────────────┐
│                  Application                     │
├─────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │ Org A   │  │ Org B   │  │ Org C   │          │
│  │ (Data)  │  │ (Data)  │  │ (Data)  │          │
│  └─────────┘  └─────────┘  └─────────┘          │
├─────────────────────────────────────────────────┤
│              Shared Database                     │
└─────────────────────────────────────────────────┘
```

### 1.2 organizationId

- **Definition**: The core identifier that isolates all data per organisation
- **Location**: Every entity table has an `organizationId` column
- **Enforcement**: An organizationId filter is mandatory in every query

```typescript
// Correct example
const apps = await prisma.app.findMany({
  where: { organizationId }, // ✅ includes organizationId
});

// Incorrect example - risk of data leakage!
const apps = await prisma.app.findMany({
  where: { id: appId }, // ❌ organizationId missing
});
```

---

## 2. Authentication Helper Functions

### 2.1 requireOrganization()

The most frequently used helper. Requires an authenticated user + an organisation.

**File**: `src/lib/auth/require-auth.ts`

```typescript
import { requireOrganization } from "@/lib/auth/require-auth";

export async function getApps() {
  const { organizationId, userId, role, session } = await requireOrganization();

  // Run the query with organizationId guaranteed
  const apps = await prisma.app.findMany({
    where: { organizationId },
  });

  return apps;
}
```

**Return values**:
| Field | Type | Description |
|------|------|------|
| `session` | `Session` | NextAuth session object |
| `organizationId` | `string` | Current user's organisation ID |
| `userId` | `string` | Current user ID |
| `role` | `"ADMIN" \| "MEMBER" \| "VIEWER"` | User role |

**Automatic redirects**:

- No session → `/login`
- No organisation → `/onboarding`

### 2.2 requireAuth()

Use when only authentication is required, without an organisation.

```typescript
import { requireAuth } from "@/lib/auth/require-auth";

// Used in APIs called before onboarding is complete
export async function createOrganization() {
  const session = await requireAuth();
  // session.user is accessible
}
```

### 2.3 getCachedSession()

Caches the session when it is read multiple times within the same request.

```typescript
import { getCachedSession } from "@/lib/auth/require-auth";

// Wrapped in React's cache() to prevent duplicate calls within the same request
const session = await getCachedSession();
```

---

## 3. Prisma Query Patterns

### 3.1 Basic Read Pattern

```typescript
// ✅ Correct pattern
export async function getApps() {
  const { organizationId } = await requireOrganization();

  return prisma.app.findMany({
    where: { organizationId }, // Always include organizationId
  });
}
```

### 3.2 Single-Record Read

```typescript
export async function getApp(id: string) {
  const { organizationId } = await requireOrganization();

  // Use findFirst to verify organizationId at the same time
  const app = await prisma.app.findFirst({
    where: {
      id,
      organizationId, // ✅ Prevents access to another organisation's data
    },
  });

  if (!app) {
    throw new Error("App not found");
  }

  return app;
}
```

### 3.3 Create Pattern

```typescript
export async function createApp(formData: FormData) {
  const { organizationId, userId } = await requireOrganization();

  const app = await prisma.app.create({
    data: {
      name: formData.get("name") as string,
      organizationId, // ✅ Required: assign the owning organisation
    },
  });

  // The audit log also includes organizationId
  await prisma.auditLog.create({
    data: {
      action: "CREATE_APP",
      entityType: "App",
      entityId: app.id,
      userId,
      organizationId,
    },
  });

  return app;
}
```

### 3.4 Update/Delete Pattern

```typescript
export async function updateApp(id: string, data: UpdateAppData) {
  const { organizationId, userId } = await requireOrganization();

  // 1. First confirm the record belongs to this organisation
  const existing = await prisma.app.findFirst({
    where: { id, organizationId },
  });

  if (!existing) {
    throw new Error("App not found");
  }

  // 2. Perform the update
  return prisma.app.update({
    where: { id },
    data,
  });
}
```

### 3.5 Validating Related Data

```typescript
export async function assignOwner(appId: string, ownerId: string) {
  const { organizationId } = await requireOrganization();

  // Verify that the owner belongs to the same organisation
  const owner = await prisma.user.findFirst({
    where: {
      id: ownerId,
      organizationId, // ✅ Only users from the same organisation are allowed
    },
  });

  if (!owner) {
    throw new Error("The specified owner does not belong to the organisation");
  }

  return prisma.app.update({
    where: { id: appId },
    data: { ownerId },
  });
}
```

---

## 4. Role-Based Access Control

### 4.1 Role Definitions

| Role     | Permissions                                              |
| -------- | -------------------------------------------------------- |
| `ADMIN`  | All operations (create, update, delete, change settings) |
| `MEMBER` | Read, create, update                                     |
| `VIEWER` | Read only                                                |

### 4.2 Role Check Pattern

```typescript
export async function deleteApp(id: string) {
  const { organizationId, role } = await requireOrganization();

  // Only ADMIN can delete
  if (role !== "ADMIN") {
    throw new Error("You do not have permission to delete");
  }

  return prisma.app.delete({
    where: { id },
  });
}
```

### 4.3 Role-Based Rendering in the UI

```tsx
"use client";

import { useSession } from "next-auth/react";

export function AppActions({ appId }: { appId: string }) {
  const { data: session } = useSession();
  const role = session?.user?.role;

  return (
    <div>
      <Button variant="outline">View</Button>

      {role !== "VIEWER" && <Button variant="outline">Edit</Button>}

      {role === "ADMIN" && <Button variant="destructive">Delete</Button>}
    </div>
  );
}
```

---

## 5. Testing Patterns

### 5.1 Session Mocking

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { getApps } from "./apps";

// Module mocking
vi.mock("@/lib/auth/require-auth", () => ({
  requireOrganization: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    app: {
      findMany: vi.fn(),
    },
  },
}));

import { requireOrganization } from "@/lib/auth/require-auth";

describe("getApps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return apps for the current organization", async () => {
    // Arrange: mock the session
    vi.mocked(requireOrganization).mockResolvedValue({
      session: {} as any,
      organizationId: "org-123",
      userId: "user-456",
      role: "ADMIN",
    });

    const mockApps = [{ id: "app-1", name: "Test App" }];
    vi.mocked(prisma.app.findMany).mockResolvedValue(mockApps);

    // Act
    const result = await getApps();

    // Assert
    expect(prisma.app.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-123" },
    });
    expect(result).toEqual(mockApps);
  });
});
```

### 5.2 Cross-Organisation Access Test

```typescript
it("should not return apps from other organizations", async () => {
  // Signed in as organisation A
  vi.mocked(requireOrganization).mockResolvedValue({
    organizationId: "org-A",
    // ...
  });

  // Attempt to read an app belonging to organisation B
  const result = await getApp("app-from-org-B");

  // Returns null or throws because of the organisation check
  expect(result).toBeNull();
});
```

### 5.3 Role Tests

```typescript
it("should throw error when VIEWER tries to delete", async () => {
  vi.mocked(requireOrganization).mockResolvedValue({
    organizationId: "org-123",
    role: "VIEWER", // Viewer role
    // ...
  });

  await expect(deleteApp("app-1")).rejects.toThrow(
    "You do not have permission to delete"
  );
});

it("should allow ADMIN to delete", async () => {
  vi.mocked(requireOrganization).mockResolvedValue({
    organizationId: "org-123",
    role: "ADMIN", // Admin role
    // ...
  });

  await deleteApp("app-1");

  expect(prisma.app.delete).toHaveBeenCalled();
});
```

---

## 6. Checklist

### Code Review Checks

- [ ] Every Prisma query includes an `organizationId` condition
- [ ] `requireOrganization()` or `requireAuth()` is called
- [ ] Related data (ownerId, etc.) is verified to belong to the same organisation
- [ ] Role-based permission checks are in place (delete, settings changes, etc.)
- [ ] Audit logs include `organizationId`
- [ ] Tests verify isolation using different organizationId values

### Anti-Patterns (Strictly Prohibited)

```typescript
// ❌ Reading everything without organizationId
const allApps = await prisma.app.findMany();

// ❌ Reading by id alone (allows access to another organisation's data)
const app = await prisma.app.findUnique({ where: { id } });

// ❌ Setting a relationship without organisation verification
await prisma.app.update({
  where: { id },
  data: { ownerId: anyUserId }, // May be a user from another organisation
});
```

---

## Related Documents

- [02-development-principles.md](./02-development-principles.md) - Development principles
- [09-error-handling-strategy.md](./09-error-handling-strategy.md) - Error handling strategy
- [11-audit-logging.md](./11-audit-logging.md) - Audit logging
