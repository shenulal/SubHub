# 09. Error Handling Strategy Guide

This document describes the standard error handling patterns for Server Actions and API Routes.

## Table of Contents

1. [ActionState Pattern](#1-actionstate-pattern)
2. [Error Response Decision Matrix](#2-error-response-decision-matrix)
3. [Server Action Error Handling](#3-server-action-error-handling)
4. [API Route Error Handling](#4-api-route-error-handling)
5. [Client Error Handling](#5-client-error-handling)
6. [Testing Patterns](#6-testing-patterns)

---

## 1. ActionState Pattern

### 1.1 Type Definition

**File**: `src/types/index.ts`

```typescript
export interface ActionState<T = null> {
  success: boolean; // Whether the action succeeded
  message?: string; // Message to display to the user
  data?: T; // Data returned on success
  errors?: Record<string, string[]>; // Per-field validation errors
}
```

### 1.2 Response Types

#### Success Responses

```typescript
// Success without data
return { success: true };

// Success with data
return { success: true, data: { id: app.id } };

// Success with a message
return { success: true, message: "The app has been created" };
```

#### Validation Errors

```typescript
// Zod validation failure
const result = schema.safeParse(data);
if (!result.success) {
  return {
    success: false,
    errors: result.error.flatten().fieldErrors as Record<string, string[]>,
  };
}
```

#### Business Rule Errors

```typescript
// Duplicate check failed
if (existingApp) {
  return { success: false, message: "An app with this name already exists" };
}

// Insufficient permissions
if (role !== "ADMIN") {
  return { success: false, message: "You do not have permission to delete" };
}
```

---

## 2. Error Response Decision Matrix

### 2.1 Server Action Error Types

| Scenario                     | Response method           | Example                       |
| ---------------------------- | ------------------------- | ----------------------------- |
| **No session**               | `redirect('/login')`      | Sign-in required              |
| **No organisation**          | `redirect('/onboarding')` | Onboarding required           |
| **Validation failure**       | `ActionState.errors`      | Per-field error messages      |
| **Business rule violation**  | `ActionState.message`     | "This name is already in use" |
| **Resource not found**       | `ActionState.message`     | "App not found"               |
| **Insufficient permissions** | `ActionState.message`     | "You do not have permission"  |
| **DB/network error**         | `ActionState.message`     | Generic error message         |

### 2.2 API Route Error Types

| Scenario                     | HTTP status      | Response format                           |
| ---------------------------- | ---------------- | ----------------------------------------- |
| **No session**               | 401 Unauthorized | `{ error: "Authentication required" }`    |
| **Insufficient permissions** | 403 Forbidden    | `{ error: "You do not have permission" }` |
| **Resource not found**       | 404 Not Found    | `{ error: "Not found" }`                  |
| **Validation error**         | 400 Bad Request  | `{ error: "...", errors: {...} }`         |
| **Server error**             | 500 Internal     | `{ error: "Server error" }`               |

---

## 3. Server Action Error Handling

### 3.1 Basic Pattern

```typescript
"use server";

import { requireOrganization } from "@/lib/auth/require-auth";
import type { ActionState } from "@/types";

// Helper to detect redirect errors
function isRedirectError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const hasRedirectDigest =
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    ((error as { digest: string }).digest.includes("NEXT_REDIRECT") ||
      (error as { digest: string }).digest.includes("NEXT_NOT_FOUND"));

  const hasRedirectMessage = error.message?.includes("NEXT_REDIRECT") ?? false;

  return hasRedirectDigest || hasRedirectMessage;
}

export async function createApp(
  _prevState: ActionState<{ id: string }>,
  formData: FormData
): Promise<ActionState<{ id: string }>> {
  try {
    // 1. Verify authentication (redirects automatically)
    const { organizationId, userId } = await requireOrganization();

    // 2. Parse the input data
    const rawData = {
      name: formData.get("name") as string,
      category: formData.get("category") as string | null,
    };

    // 3. Validate
    const result = createAppSchema.safeParse(rawData);
    if (!result.success) {
      return {
        success: false,
        errors: result.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    // 4. Check business rules
    const existing = await prisma.app.findFirst({
      where: { organizationId, name: result.data.name },
    });
    if (existing) {
      return {
        success: false,
        message: "An app with this name already exists",
      };
    }

    // 5. Create the record
    const app = await prisma.app.create({
      data: { ...result.data, organizationId },
    });

    // 6. Invalidate the cache
    revalidatePath("/apps");

    // 7. Success response
    return { success: true, data: { id: app.id } };
  } catch (error) {
    // 8. Re-throw redirect errors (required by Next.js)
    if (isRedirectError(error)) throw error;

    // 9. Log and return a generic error response
    console.error("App creation error:", error);
    return {
      success: false,
      message: "An error occurred while creating the app",
    };
  }
}
```

### 3.2 isRedirectError Is Mandatory

Next.js `redirect()` throws a special error. If you catch it and do not re-throw it, the redirect will not work.

```typescript
try {
  await requireOrganization(); // May call redirect() internally
  // ...
} catch (error) {
  // ⚠️ Important: redirect errors must always be re-thrown
  if (isRedirectError(error)) throw error;

  // Handle all other errors only
  return { success: false, message: "An error occurred" };
}
```

### 3.3 Error Logging

```typescript
catch (error) {
  if (isRedirectError(error)) throw error;

  // Development: print the full error
  // Production: send to an error tracking service (Sentry, etc.)
  console.error("App creation error:", error);

  // Show the user a generic message
  return { success: false, message: "An error occurred while creating the app" };
}
```

---

## 4. API Route Error Handling

### 4.1 Basic Pattern

```typescript
// src/app/api/v1/apps/route.ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    // 1. Verify authentication
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");

    // 3. Fetch data
    const apps = await getApps({ page });

    // 4. Success response
    return NextResponse.json(apps);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "A server error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse JSON
    const body = await request.json();

    // Convert to FormData to call the Server Action
    const formData = new FormData();
    Object.entries(body).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    });

    // Call the Server Action
    const result = await createApp({ success: false }, formData);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message, errors: result.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "A server error occurred" },
      { status: 500 }
    );
  }
}
```

### 4.2 HTTP Status Code Guide

| Status code                 | When to use                           |
| --------------------------- | ------------------------------------- |
| `200 OK`                    | Successful GET                        |
| `201 Created`               | Successful POST (resource created)    |
| `204 No Content`            | Successful DELETE                     |
| `400 Bad Request`           | Validation failure, malformed request |
| `401 Unauthorized`          | Authentication required               |
| `403 Forbidden`             | Insufficient permissions              |
| `404 Not Found`             | Resource not found                    |
| `500 Internal Server Error` | Server error                          |

---

## 5. Client Error Handling

### 5.1 Using useActionState

```tsx
"use client";

import { useActionState } from "react";
import { createApp } from "@/actions/apps";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AppForm() {
  const [state, formAction, isPending] = useActionState(createApp, {
    success: false,
  });

  return (
    <form action={formAction}>
      {/* General error message */}
      {!state.success && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      {/* Per-field errors */}
      <div>
        <Input name="name" />
        {state.errors?.name && (
          <p className="text-destructive text-sm">{state.errors.name[0]}</p>
        )}
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Processing..." : "Create"}
      </Button>
    </form>
  );
}
```

### 5.2 Redirect After Success

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AppForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createApp, {
    success: false,
  });

  useEffect(() => {
    if (state.success && state.data?.id) {
      router.push(`/apps/${state.data.id}`);
    }
  }, [state, router]);

  // ...
}
```

---

## 6. Testing Patterns

### 6.1 Success Case Test

```typescript
it("should create app successfully", async () => {
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

  const result = await createApp({ success: false }, formData);

  expect(result.success).toBe(true);
  expect(result.data?.id).toBe("app-789");
});
```

### 6.2 Validation Error Test

```typescript
it("should return validation errors for empty name", async () => {
  vi.mocked(requireOrganization).mockResolvedValue({
    organizationId: "org-123",
    // ...
  });

  const formData = new FormData();
  formData.set("name", ""); // Empty name

  const result = await createApp({ success: false }, formData);

  expect(result.success).toBe(false);
  expect(result.errors?.name).toBeDefined();
  expect(result.errors?.name[0]).toContain("at least 2 characters");
});
```

### 6.3 Business Rule Error Test

```typescript
it("should return error for duplicate name", async () => {
  vi.mocked(requireOrganization).mockResolvedValue({
    organizationId: "org-123",
    // ...
  });

  // An app that already exists
  vi.mocked(prisma.app.findFirst).mockResolvedValue({ id: "existing" } as any);

  const formData = new FormData();
  formData.set("name", "Existing App");

  const result = await createApp({ success: false }, formData);

  expect(result.success).toBe(false);
  expect(result.message).toBe("An app with this name already exists");
});
```

### 6.4 Redirect Test

```typescript
it("should redirect when not authenticated", async () => {
  // Mock that throws a redirect error
  vi.mocked(requireOrganization).mockImplementation(() => {
    const error = new Error("NEXT_REDIRECT");
    (error as any).digest = "NEXT_REDIRECT;/login";
    throw error;
  });

  const formData = new FormData();
  formData.set("name", "Test");

  // The redirect error must be re-thrown
  await expect(createApp({ success: false }, formData)).rejects.toThrow(
    "NEXT_REDIRECT"
  );
});
```

---

## Checklist

### When Implementing a Server Action

- [ ] Call `requireOrganization()` or `requireAuth()`
- [ ] Validate with a Zod schema (use safeParse)
- [ ] Check business rules (duplicates, permissions, etc.)
- [ ] Handle errors with try-catch
- [ ] Check `isRedirectError()` and re-throw
- [ ] Log generic errors, then return a user-friendly message

### When Implementing an API Route

- [ ] Verify the session and return 401 when absent
- [ ] Use appropriate HTTP status codes
- [ ] Keep the JSON response format consistent
- [ ] Log errors

---

## Related Documents

- [08-multi-tenant-patterns.md](./08-multi-tenant-patterns.md) - Multi-tenant patterns
- [10-form-data-patterns.md](./10-form-data-patterns.md) - FormData patterns
- [04-test-templates.md](./04-test-templates.md) - Test templates
