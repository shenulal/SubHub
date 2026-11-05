# 11. Audit Logging Guide

This document describes the patterns for creating, querying and testing audit logs in SubHub.

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Audit Log Schema](#2-audit-log-schema)
3. [Audit Log Creation Patterns](#3-audit-log-creation-patterns)
4. [Standard Action Naming Conventions](#4-standard-action-naming-conventions)
5. [Querying Audit Logs](#5-querying-audit-logs)
6. [Test Patterns](#6-test-patterns)

---

## 1. Core Concepts

### 1.1 What Is an Audit Log?

An audit log records significant events that occur in the system, for use in **security**, **compliance** and **debugging**.

```
┌─────────────────────────────────────────────────────────┐
│                    Audit Log Entry                       │
├─────────────────────────────────────────────────────────┤
│  WHO: userId, userName                                  │
│  WHAT: action, entityType, entityId                     │
│  WHEN: createdAt                                        │
│  WHERE: ipAddress, userAgent                            │
│  DETAILS: changes, metadata                             │
└─────────────────────────────────────────────────────────┘
```

### 1.2 When to Create an Audit Log

| Action Type | Required | Description                                          |
| ----------- | :------: | ---------------------------------------------------- |
| **CREATE**  |   Yes    | Resource creation (apps, subscriptions, users, etc.) |
| **UPDATE**  |   Yes    | Resource update                                      |
| **DELETE**  |   Yes    | Resource deletion                                    |
| **LOGIN**   |   Yes    | User sign-in                                         |
| **LOGOUT**  |   Yes    | User sign-out                                        |
| **SYNC**    |   Yes    | External system synchronisation                      |
| **EXPORT**  |   Yes    | Data export                                          |
| **IMPORT**  |   Yes    | Data import                                          |
| **VIEW**    |    No    | Simple read access (optional)                        |

### 1.3 Multi-Tenant Isolation

Audit logs are also isolated by `organizationId`:

```typescript
// ✅ Correct pattern
await prisma.auditLog.create({
  data: {
    action: "CREATE_APP",
    organizationId, // Required
    userId,
    // ...
  },
});
```

---

## 2. Audit Log Schema

### 2.1 Prisma Model

**File**: `prisma/schema.prisma`

```prisma
model AuditLog {
  id String @id @default(cuid())

  organizationId String       @map("organization_id")
  organization   Organization @relation(...)

  userId String? @map("user_id")
  user   User?   @relation(...)

  action     String
  entityType String  @map("entity_type")
  entityId   String? @map("entity_id")

  changes  Json?   // Before/after data
  metadata Json?   // Additional context information

  ipAddress String? @map("ip_address")
  userAgent String? @map("user_agent")

  createdAt DateTime @default(now()) @map("created_at")

  @@index([organizationId])
  @@index([userId])
  @@index([action])
  @@index([createdAt])
  @@map("audit_logs")
}
```

### 2.2 Field Descriptions

| Field            | Type     | Required | Description                                          |
| ---------------- | -------- | :------: | ---------------------------------------------------- |
| `id`             | String   |   Yes    | CUID unique identifier                               |
| `organizationId` | String   |   Yes    | For tenant isolation                                 |
| `userId`         | String   |    No    | User who performed the action (null for system jobs) |
| `action`         | String   |   Yes    | Action performed (CREATE_APP, etc.)                  |
| `entityType`     | String   |   Yes    | Target entity type (App, User, etc.)                 |
| `entityId`       | String   |    No    | Target entity ID                                     |
| `changes`        | Json     |    No    | Before/after data                                    |
| `metadata`       | Json     |    No    | Additional information (app name, etc.)              |
| `ipAddress`      | String   |    No    | Request IP address                                   |
| `userAgent`      | String   |    No    | Browser/client information                           |
| `createdAt`      | DateTime |   Yes    | Creation timestamp                                   |

---

## 3. Audit Log Creation Patterns

### 3.1 Basic Pattern

```typescript
import { prisma } from "@/lib/db";
import { requireOrganization } from "@/lib/auth/require-auth";

export async function createApp(formData: FormData) {
  const { organizationId, userId } = await requireOrganization();

  // 1. Perform the business logic
  const app = await prisma.app.create({
    data: {
      name: formData.get("name") as string,
      organizationId,
    },
  });

  // 2. Create the audit log
  await prisma.auditLog.create({
    data: {
      action: "CREATE_APP",
      entityType: "App",
      entityId: app.id,
      userId,
      organizationId,
      metadata: { appName: app.name },
    },
  });

  return { success: true, data: { id: app.id } };
}
```

### 3.2 Recording Changes on Update

```typescript
export async function updateApp(id: string, formData: FormData) {
  const { organizationId, userId } = await requireOrganization();

  // 1. Fetch the existing data
  const existingApp = await prisma.app.findFirst({
    where: { id, organizationId },
  });

  if (!existingApp) {
    return { success: false, message: "App not found" };
  }

  // 2. Perform the update
  const newName = formData.get("name") as string;
  const app = await prisma.app.update({
    where: { id },
    data: { name: newName },
  });

  // 3. Create the audit log together with the change history
  await prisma.auditLog.create({
    data: {
      action: "UPDATE_APP",
      entityType: "App",
      entityId: app.id,
      userId,
      organizationId,
      changes: {
        before: { name: existingApp.name },
        after: { name: app.name },
      },
      metadata: { appName: app.name },
    },
  });

  return { success: true };
}
```

### 3.3 Deletion Pattern

```typescript
export async function deleteApp(id: string) {
  const { organizationId, userId, role } = await requireOrganization();

  if (role !== "ADMIN") {
    return { success: false, message: "Administrator permission is required" };
  }

  const existingApp = await prisma.app.findFirst({
    where: { id, organizationId },
  });

  if (!existingApp) {
    return { success: false, message: "App not found" };
  }

  // 1. Perform the deletion
  await prisma.app.delete({ where: { id } });

  // 2. Audit log (preserves the deleted entity's information)
  await prisma.auditLog.create({
    data: {
      action: "DELETE_APP",
      entityType: "App",
      entityId: id, // Record the deleted ID
      userId,
      organizationId,
      metadata: {
        appName: existingApp.name,
        deletedData: existingApp, // Preserve the full data when needed
      },
    },
  });

  return { success: true };
}
```

### 3.4 System Jobs (No userId)

```typescript
// Cron jobs, external system integrations, etc.
export async function syncIntegration(integrationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  // Synchronisation logic...

  // For system jobs, userId is null
  await prisma.auditLog.create({
    data: {
      action: "SYNC_INTEGRATION",
      entityType: "Integration",
      entityId: integrationId,
      userId: null, // System job
      organizationId: integration!.organizationId,
      metadata: {
        syncedAt: new Date().toISOString(),
        recordsProcessed: 150,
      },
    },
  });
}
```

### 3.5 Audit Logs Within a Transaction

Wrap critical operations in a transaction to guarantee consistency:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Business logic
  const app = await tx.app.create({
    data: { name: "New App", organizationId },
  });

  // 2. Audit log (same transaction)
  await tx.auditLog.create({
    data: {
      action: "CREATE_APP",
      entityType: "App",
      entityId: app.id,
      userId,
      organizationId,
    },
  });

  return app;
});
```

---

## 4. Standard Action Naming Conventions

### 4.1 Action Name Format

```
{VERB}_{ENTITY}
```

- **Verb**: CREATE, UPDATE, DELETE, LOGIN, LOGOUT, SYNC, EXPORT, IMPORT
- **Entity**: APP, SUBSCRIPTION, USER, INTEGRATION, ORGANIZATION, PAYMENT

### 4.2 Standard Action List

#### App Actions

| Action             | Description         |
| ------------------ | ------------------- |
| `CREATE_APP`       | Create an app       |
| `UPDATE_APP`       | Update an app       |
| `DELETE_APP`       | Delete an app       |
| `ASSIGN_APP_OWNER` | Assign an app owner |

#### Subscription Actions

| Action                | Description           |
| --------------------- | --------------------- |
| `CREATE_SUBSCRIPTION` | Create a subscription |
| `UPDATE_SUBSCRIPTION` | Update a subscription |
| `DELETE_SUBSCRIPTION` | Delete a subscription |
| `RENEW_SUBSCRIPTION`  | Renew a subscription  |

#### User Actions

| Action            | Description       |
| ----------------- | ----------------- |
| `CREATE_USER`     | Create a user     |
| `UPDATE_USER`     | Update a user     |
| `DELETE_USER`     | Delete a user     |
| `INVITE_USER`     | Invite a user     |
| `DEACTIVATE_USER` | Deactivate a user |

#### Authentication Actions

| Action           | Description     |
| ---------------- | --------------- |
| `LOGIN`          | Sign in         |
| `LOGOUT`         | Sign out        |
| `LOGIN_FAILED`   | Sign-in failure |
| `PASSWORD_RESET` | Password reset  |

#### Integration Actions

| Action               | Description                |
| -------------------- | -------------------------- |
| `CREATE_INTEGRATION` | Create an integration      |
| `UPDATE_INTEGRATION` | Update an integration      |
| `DELETE_INTEGRATION` | Delete an integration      |
| `SYNC_INTEGRATION`   | Synchronise an integration |
| `SYNC_FAILED`        | Synchronisation failure    |

#### Data Actions

| Action        | Description |
| ------------- | ----------- |
| `EXPORT_DATA` | Export data |
| `IMPORT_DATA` | Import data |
| `BULK_UPDATE` | Bulk update |

### 4.3 Entity Type List

```typescript
const entityTypes = [
  "App",
  "Subscription",
  "User",
  "Integration",
  "Organization",
  "Payment",
  "Report",
  "Invitation",
];
```

---

## 5. Querying Audit Logs

### 5.1 List Query (Pagination)

**File**: `src/actions/audit.ts`

```typescript
export interface AuditLogFilters {
  action?: string;
  userId?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getAuditLogs(
  filters: AuditLogFilters
): Promise<AuditLogListResponse> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const organizationId = session.user.organizationId;
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { organizationId };

  // Add filter conditions
  if (filters.action) where.action = filters.action;
  if (filters.userId) where.userId = filters.userId;
  if (filters.entityType) where.entityType = filters.entityType;

  // Date range
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      where.createdAt.lte = new Date(filters.endDate);
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      userId: log.userId,
      userName: log.user?.name ?? null,
      userEmail: log.user?.email ?? null,
      changes: log.changes,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString(),
    })),
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}
```

### 5.2 Fetching Filter Options

```typescript
export async function getAuditLogFilterOptions(): Promise<AuditLogFilterOptions> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const users = await prisma.user.findMany({
    where: { organizationId: session.user.organizationId },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return {
    actions: [
      "CREATE",
      "UPDATE",
      "DELETE",
      "LOGIN",
      "LOGOUT",
      "SYNC",
      "EXPORT",
      "IMPORT",
    ],
    entityTypes: [
      "App",
      "Subscription",
      "User",
      "Integration",
      "Organization",
      "Payment",
    ],
    users: users.map((u) => ({
      id: u.id,
      name: u.name ?? "",
      email: u.email,
    })),
  };
}
```

---

## 6. Test Patterns

### 6.1 Verifying Audit Log Creation

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { createApp } from "./apps";

vi.mock("@/lib/db", () => ({
  prisma: {
    app: { create: vi.fn(), findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireOrganization: vi.fn(),
}));

describe("createApp - Audit Logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create audit log on app creation", async () => {
    // Arrange
    vi.mocked(requireOrganization).mockResolvedValue({
      organizationId: "org-123",
      userId: "user-456",
      role: "ADMIN",
      session: {} as any,
    });

    vi.mocked(prisma.app.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.app.create).mockResolvedValue({
      id: "app-789",
      name: "Test App",
    } as any);

    const formData = new FormData();
    formData.set("name", "Test App");

    // Act
    const result = await createApp({ success: false }, formData);

    // Assert
    expect(result.success).toBe(true);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CREATE_APP",
        entityType: "App",
        entityId: "app-789",
        userId: "user-456",
        organizationId: "org-123",
        metadata: { appName: "Test App" },
      }),
    });
  });
});
```

### 6.2 Verifying the Audit Log on Deletion

```typescript
it("should create audit log with deleted data on app deletion", async () => {
  vi.mocked(requireOrganization).mockResolvedValue({
    organizationId: "org-123",
    userId: "user-456",
    role: "ADMIN",
    session: {} as any,
  });

  vi.mocked(prisma.app.findFirst).mockResolvedValue({
    id: "app-789",
    name: "Deleted App",
    organizationId: "org-123",
  } as any);

  vi.mocked(prisma.app.delete).mockResolvedValue({} as any);

  // Act
  const result = await deleteApp("app-789");

  // Assert
  expect(prisma.auditLog.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      action: "DELETE_APP",
      entityType: "App",
      entityId: "app-789",
      metadata: expect.objectContaining({
        appName: "Deleted App",
      }),
    }),
  });
});
```

### 6.3 Audit Log Query Tests

```typescript
describe("getAuditLogs", () => {
  it("should filter by organizationId", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { organizationId: "org-123" },
    } as any);

    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);

    await getAuditLogs({});

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-123",
        }),
      })
    );
  });

  it("should apply date filters", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { organizationId: "org-123" },
    } as any);

    await getAuditLogs({
      startDate: "2024-01-01",
      endDate: "2024-01-31",
    });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date("2024-01-01"),
            lte: new Date("2024-01-31"),
          },
        }),
      })
    );
  });
});
```

---

## Checklist

### When Creating Audit Logs

- [ ] Include `organizationId` (multi-tenant isolation)
- [ ] Use an appropriate `action` name (standard naming convention)
- [ ] Set `entityType` and `entityId`
- [ ] On deletion, preserve the deleted data in `metadata`
- [ ] On update, record before/after data in `changes`

### When Querying Audit Logs

- [ ] Filter by `organizationId` (prevents access to other organisations)
- [ ] Apply pagination
- [ ] Sort newest first (`createdAt: "desc"`)

### When Testing

- [ ] Verify the audit log creation function is called
- [ ] Verify the correct `action` and `entityType`
- [ ] Verify `organizationId` is included

---

## Related Documents

- [08-multi-tenant-patterns.md](./08-multi-tenant-patterns.md) - Multi-tenant patterns
- [09-error-handling-strategy.md](./09-error-handling-strategy.md) - Error handling strategy
- [05-common-patterns.md](./05-common-patterns.md) - Common test patterns
