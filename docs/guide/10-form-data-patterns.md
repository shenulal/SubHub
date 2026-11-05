# 10. FormData Patterns Guide

This document describes the patterns for parsing FormData in Server Actions and validating it with Zod.

## Table of Contents

1. [Server Action Signature](#1-server-action-signature)
2. [Parsing FormData](#2-parsing-formdata)
3. [Zod Validation](#3-zod-validation)
4. [JSON → FormData in API Routes](#4-json--formdata-in-api-routes)
5. [Client Integration](#5-client-integration)
6. [Test Patterns](#6-test-patterns)

---

## 1. Server Action Signature

### 1.1 Basic Signature (for useActionState)

```typescript
"use server";

import type { ActionState } from "@/types";

export async function createApp(
  _prevState: ActionState<{ id: string }>, // Previous state (required by useActionState)
  formData: FormData // Form data
): Promise<ActionState<{ id: string }>> {
  // Return type
  // ...
}
```

### 1.2 Signature with an ID Parameter (Update Actions)

```typescript
export async function updateApp(
  id: string, // ID of the resource to update
  _prevState: ActionState<{ id: string }>,
  formData: FormData
): Promise<ActionState<{ id: string }>> {
  // ...
}
```

### 1.3 Calling from the Client

```tsx
"use client";

import { useActionState } from "react";
import { createApp, updateApp } from "@/actions/apps";

// Create: basic call
const [state, formAction] = useActionState(createApp, { success: false });

// Update: fix the ID with bind
const updateAppWithId = updateApp.bind(null, appId);
const [state, formAction] = useActionState(updateAppWithId, { success: false });
```

---

## 2. Parsing FormData

### 2.1 Basic Parsing

```typescript
const rawData = {
  name: formData.get("name") as string,
  category: formData.get("category") as string | null,
  notes: formData.get("notes") as string | null,
};
```

### 2.2 Parsing by Type

#### String (Required)

```typescript
const name = formData.get("name") as string;
// An empty string is handled as an error by Zod
```

#### String (Optional)

```typescript
const category = formData.get("category") as string | null;
// May be null or an empty string
```

#### Number

```typescript
const amount = formData.get("amount");
const parsedAmount = amount ? Number(amount) : null;
// Alternatively, use coerce in Zod
```

#### Boolean (Checkbox)

```typescript
const isActive = formData.get("isActive") === "on";
// A checkbox sends "on" when checked and null when unchecked
```

#### Array (Comma-Separated String)

```typescript
const tagsString = formData.get("tags") as string | null;
const tags = tagsString
  ? tagsString
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
  : [];
```

#### File

```typescript
const file = formData.get("file") as File | null;
if (file && file.size > 0) {
  // Process the file
}
```

### 2.3 Complete Parsing Example

```typescript
export async function createApp(
  _prevState: ActionState<{ id: string }>,
  formData: FormData
): Promise<ActionState<{ id: string }>> {
  const { organizationId, userId } = await requireOrganization();

  // Convert FormData → object
  const rawData = {
    name: formData.get("name") as string,
    category: formData.get("category") as string | null,
    customLogoUrl: formData.get("customLogoUrl") as string | null,
    customWebsite: formData.get("customWebsite") as string | null,
    notes: formData.get("notes") as string | null,
    tags: formData.get("tags") as string | null,
    ownerId: formData.get("ownerId") as string | null,
    catalogId: formData.get("catalogId") as string | null,
  };

  // Zod validation follows...
}
```

---

## 3. Zod Validation

### 3.1 Schema Definition

```typescript
import { z } from "zod";

const createAppSchema = z.object({
  name: z
    .string()
    .min(2, "App name must be at least 2 characters")
    .max(100, "App name must be 100 characters or fewer"),

  category: z.string().nullish(), // Allows null or undefined

  customLogoUrl: z
    .string()
    .url("Please enter a valid URL")
    .nullish()
    .or(z.literal("")), // Also allows an empty string

  customWebsite: z
    .string()
    .url("Please enter a valid URL")
    .nullish()
    .or(z.literal("")),

  notes: z
    .string()
    .max(1000, "Notes must be 1000 characters or fewer")
    .nullish(),

  tags: z.string().nullish(), // Parsed separately

  ownerId: z.string().nullish(),

  catalogId: z.string().nullish(),
});
```

### 3.2 Using safeParse (Recommended)

```typescript
// ✅ safeParse: does not throw errors
const result = createAppSchema.safeParse(rawData);

if (!result.success) {
  return {
    success: false,
    errors: result.error.flatten().fieldErrors as Record<string, string[]>,
  };
}

const data = result.data; // Type-safe data
```

### 3.3 Using parse (Not Recommended)

```typescript
// ❌ parse: throws errors - requires try-catch
try {
  const data = createAppSchema.parse(rawData);
} catch (error) {
  if (error instanceof z.ZodError) {
    // Handle the error
  }
}
```

### 3.4 Advanced Schema Patterns

#### Number Conversion (coerce)

```typescript
const subscriptionSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  seats: z.coerce.number().int().min(1, "At least 1 seat is required"),
});
```

#### Date Conversion

```typescript
const dateSchema = z.object({
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : null)),
});
```

#### Conditional Fields

```typescript
const schema = z
  .object({
    type: z.enum(["monthly", "yearly"]),
    billingCycle: z.number().optional(),
  })
  .refine(
    (data) => {
      if (data.type === "monthly") {
        return data.billingCycle !== undefined;
      }
      return true;
    },
    {
      message: "A billing cycle is required for monthly subscriptions",
      path: ["billingCycle"],
    }
  );
```

#### Enum

```typescript
import { AppStatus } from "@prisma/client";

const updateAppSchema = createAppSchema.extend({
  status: z.nativeEnum(AppStatus).nullish(),
});
```

---

## 4. JSON → FormData in API Routes

When an API Route receives a JSON body and calls a Server Action, it converts the body to FormData.

### 4.1 Conversion Pattern

```typescript
// src/app/api/v1/apps/route.ts
import { NextResponse } from "next/server";
import { createApp } from "@/actions/apps";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { error: "Authentication is required" },
        { status: 401 }
      );
    }

    // Parse the JSON body
    const body = await request.json();

    // Convert to FormData
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

### 4.2 Handling Arrays/Objects

```typescript
const body = {
  name: "Test App",
  tags: ["tag1", "tag2"], // Array
};

const formData = new FormData();
Object.entries(body).forEach(([key, value]) => {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    // Array: convert to a comma-separated string
    formData.append(key, value.join(","));
  } else if (typeof value === "object") {
    // Object: convert to a JSON string
    formData.append(key, JSON.stringify(value));
  } else {
    formData.append(key, String(value));
  }
});
```

---

## 5. Client Integration

### 5.1 Basic Form

```tsx
"use client";

import { useActionState } from "react";
import { createApp } from "@/actions/apps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AppForm() {
  const [state, formAction, isPending] = useActionState(createApp, {
    success: false,
  });

  return (
    <form action={formAction} className="space-y-4">
      {/* General error message */}
      {!state.success && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      {/* Name field */}
      <div className="space-y-2">
        <Label htmlFor="name">App Name *</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="Enter the app name"
        />
        {state.errors?.name && (
          <p className="text-destructive text-sm">{state.errors.name[0]}</p>
        )}
      </div>

      {/* Category field (optional) */}
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Input id="category" name="category" placeholder="Enter a category" />
      </div>

      {/* Submit button */}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save"}
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
import { useActionState } from "react";

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

  // ... render the form
}
```

### 5.3 Edit Form (Initial Values)

```tsx
"use client";

import { useActionState } from "react";
import { updateApp } from "@/actions/apps";
import type { AppDetail } from "@/types/app";

interface EditFormProps {
  app: AppDetail;
}

export function AppEditForm({ app }: EditFormProps) {
  const updateAppWithId = updateApp.bind(null, app.id);
  const [state, formAction, isPending] = useActionState(updateAppWithId, {
    success: false,
  });

  return (
    <form action={formAction}>
      <Input
        name="name"
        defaultValue={app.name} // Set the initial value
      />
      <Input name="category" defaultValue={app.category ?? ""} />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Updating..." : "Update"}
      </Button>
    </form>
  );
}
```

---

## 6. Test Patterns

### 6.1 Creating FormData

```typescript
import { describe, it, expect, vi } from "vitest";

it("should create app with valid data", async () => {
  // Create FormData
  const formData = new FormData();
  formData.set("name", "Test App");
  formData.set("category", "Productivity");
  formData.set("notes", "Test notes");

  // Call the Server Action
  const result = await createApp({ success: false }, formData);

  expect(result.success).toBe(true);
});
```

### 6.2 Missing Required Field Test

```typescript
it("should return error when name is empty", async () => {
  const formData = new FormData();
  formData.set("name", ""); // Empty name

  const result = await createApp({ success: false }, formData);

  expect(result.success).toBe(false);
  expect(result.errors?.name).toBeDefined();
  expect(result.errors?.name[0]).toContain("at least 2 characters");
});
```

### 6.3 Validation Error Test

```typescript
it("should return error for invalid URL", async () => {
  const formData = new FormData();
  formData.set("name", "Test App");
  formData.set("customLogoUrl", "not-a-url"); // Invalid URL

  const result = await createApp({ success: false }, formData);

  expect(result.success).toBe(false);
  expect(result.errors?.customLogoUrl).toBeDefined();
  expect(result.errors?.customLogoUrl[0]).toContain("URL");
});
```

### 6.4 Optional Field Test

```typescript
it("should create app with only required fields", async () => {
  const formData = new FormData();
  formData.set("name", "Minimal App");
  // Optional fields such as category and notes are not set

  const result = await createApp({ success: false }, formData);

  expect(result.success).toBe(true);
});
```

### 6.5 Update Action Test

```typescript
it("should update app", async () => {
  // Mock the existing app
  vi.mocked(prisma.app.findFirst).mockResolvedValue({
    id: "app-123",
    name: "Old Name",
    organizationId: "org-123",
  } as any);

  const formData = new FormData();
  formData.set("name", "New Name");

  const result = await updateApp("app-123", { success: false }, formData);

  expect(result.success).toBe(true);
  expect(prisma.app.update).toHaveBeenCalledWith({
    where: { id: "app-123" },
    data: expect.objectContaining({ name: "New Name" }),
  });
});
```

---

## Checklist

### When Implementing a Server Action

- [ ] Use the correct signature (`_prevState`, `formData`)
- [ ] Parse every field from FormData
- [ ] Handle null/undefined
- [ ] Use Zod `safeParse()`
- [ ] Return the `errors` field on failure

### When Implementing a Form

- [ ] Use the `useActionState` hook
- [ ] Set the `name` attribute on every input field
- [ ] Display field-level error messages
- [ ] Display general error messages
- [ ] Handle the loading state (`isPending`)
- [ ] Handle the redirect after success

---

## Related Documents

- [09-error-handling-strategy.md](./09-error-handling-strategy.md) - Error handling strategy
- [04-test-templates.md](./04-test-templates.md) - Test templates
- [05-common-patterns.md](./05-common-patterns.md) - Common patterns
