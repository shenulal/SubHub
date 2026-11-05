# TDD Quick Start Guide

> **Goal**: Write your first test in under 5 minutes

---

## 1. Verify Installation

```bash
# Install dependencies (already configured in package.json)
npm install
```

---

## 2. Test Commands

```bash
# Run the tests once
npm test

# Re-run automatically on file changes (recommended during development)
npm run test:watch

# Generate a coverage report
npm run test:coverage

# Vitest UI (visual test results)
npm run test:ui

# Run the full quality check (lint + type-check + test)
npm run quality
```

---

## 3. Writing Your First Test

### 3.1 Test File Location Rule

**Co-located Pattern**: create a `.test.ts` file next to the source file

```
src/lib/utils.ts           # Source file
src/lib/utils.test.ts      # Test file (right next to it)
```

### 3.2 Example: Testing a Utility Function

```typescript
// src/lib/utils.test.ts
import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn (className merge utility)", () => {
  it("should merge class names", () => {
    // Arrange & Act
    const result = cn("px-2", "py-1");

    // Assert
    expect(result).toBe("px-2 py-1");
  });

  it("should handle conditional classes", () => {
    const isActive = true;
    const result = cn("base", isActive && "active");

    expect(result).toBe("base active");
  });

  it("should override conflicting Tailwind classes", () => {
    // The later class takes precedence
    const result = cn("px-2", "px-4");

    expect(result).toBe("px-4");
  });
});
```

---

## 4. The TDD Red-Green-Refactor Cycle

### 4.1 RED (Write a Failing Test First)

```typescript
// src/lib/services/app.test.ts
import { describe, it, expect } from "vitest";
import { calculateAppUsageScore } from "./app";

describe("calculateAppUsageScore", () => {
  it("should return high score for frequently used apps", () => {
    // The function does not exist yet - the test fails!
    const score = calculateAppUsageScore({
      loginCount: 100,
      lastLoginDaysAgo: 1,
    });

    expect(score).toBeGreaterThan(80);
  });
});
```

```bash
npm test  # Fails (RED)
```

### 4.2 GREEN (Pass with the Minimum Code)

```typescript
// src/lib/services/app.ts
export function calculateAppUsageScore({
  loginCount,
  lastLoginDaysAgo,
}: {
  loginCount: number;
  lastLoginDaysAgo: number;
}): number {
  // Minimal implementation
  if (loginCount > 50 && lastLoginDaysAgo <= 7) {
    return 85;
  }
  return 50;
}
```

```bash
npm test  # Passes (GREEN)
```

### 4.3 REFACTOR (Improve the Code, Keep the Tests Passing)

```typescript
// src/lib/services/app.ts
const SCORE_WEIGHTS = {
  LOGIN_FREQUENCY: 0.6,
  RECENCY: 0.4,
};

export function calculateAppUsageScore({
  loginCount,
  lastLoginDaysAgo,
}: {
  loginCount: number;
  lastLoginDaysAgo: number;
}): number {
  const frequencyScore = Math.min(loginCount / 100, 1) * 100;
  const recencyScore = Math.max(0, 100 - lastLoginDaysAgo * 3);

  return Math.round(
    frequencyScore * SCORE_WEIGHTS.LOGIN_FREQUENCY +
      recencyScore * SCORE_WEIGHTS.RECENCY
  );
}
```

```bash
npm test  # Still passes (REFACTOR complete)
```

---

## 5. Daily Development Workflow

```bash
# 1. Start watch mode when you begin work
npm run test:watch

# 2. Write the test first, before developing a new feature
# 3. Confirm the test fails (RED)
# 4. Write the implementation code
# 5. Confirm the test passes (GREEN)
# 6. Refactor (REFACTOR)

# 7. Run the quality check before committing
npm run quality

# 8. Commit (the pre-commit hook runs lint-staged automatically)
git add .
git commit -m "feat: add app usage score calculation"
```

---

## 6. Test File Structure by Directory

```
src/
├── actions/
│   ├── apps.ts
│   └── apps.test.ts           # Server Actions tests
├── lib/
│   ├── utils.ts
│   ├── utils.test.ts          # Utility tests
│   └── services/
│       ├── subscription/
│       │   ├── renewal.ts
│       │   └── renewal.test.ts # Service tests
│       └── sso/
│           ├── google.ts
│           └── google.test.ts
├── hooks/
│   ├── use-apps.ts
│   └── use-apps.test.ts       # Hook tests
├── components/
│   └── dashboard/
│       ├── stats-card.tsx
│       └── stats-card.test.tsx # Component tests
└── stores/
    ├── app-store.ts
    └── app-store.test.ts      # Zustand store tests
```

---

## 7. Commonly Used Test Patterns

### 7.1 Testing Async Functions

```typescript
it("should fetch apps from API", async () => {
  const apps = await fetchApps("org-1");
  expect(apps).toHaveLength(3);
});
```

### 7.2 Testing Error Cases

```typescript
it("should throw error for invalid input", () => {
  expect(() => validateAppData({ name: "" })).toThrow("Name is required");
});

// Async errors
it("should reject for unauthorized access", async () => {
  await expect(fetchProtectedData()).rejects.toThrow("Unauthorized");
});
```

### 7.3 Mocking Basics

```typescript
import { vi } from "vitest";

// Mocking a function
const mockFn = vi.fn();
mockFn.mockReturnValue("mocked value");

// Mocking a module
vi.mock("@/lib/db", () => ({
  prisma: {
    app: {
      findMany: vi.fn(),
    },
  },
}));
```

---

## 8. Multi-Tenant Test Patterns

In a multi-tenant environment, mocking the session including `organizationId` is mandatory.

```typescript
// Mock requireOrganization
vi.mock("@/lib/auth/require-auth", () => ({
  requireOrganization: vi.fn(),
}));

import { requireOrganization } from "@/lib/auth/require-auth";

it("should filter by organizationId", async () => {
  vi.mocked(requireOrganization).mockResolvedValue({
    organizationId: "org-123",
    userId: "user-456",
    role: "ADMIN",
    session: {} as any,
  });

  // Verify the query includes organizationId
  expect(prisma.app.findMany).toHaveBeenCalledWith({
    where: { organizationId: "org-123" },
  });
});
```

For details, see [08-multi-tenant-patterns.md](./08-multi-tenant-patterns.md).

---

## 9. Next Steps

- [02-development-principles.md](./02-development-principles.md) - Development principles
- [03-shadcn-ui-rules.md](./03-shadcn-ui-rules.md) - shadcn/ui component rules
- [04-test-templates.md](./04-test-templates.md) - Copy-and-use test templates
- [08-multi-tenant-patterns.md](./08-multi-tenant-patterns.md) - Multi-tenant test patterns
- [09-error-handling-strategy.md](./09-error-handling-strategy.md) - Error handling strategy
