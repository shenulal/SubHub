# Development Principles

> **Mandatory rules for TDD-based development**

---

## 1. The TDD Red-Green-Refactor Cycle (Mandatory)

### 1.1 Development Order

```
[ ] 1. RED    - Write a failing test first
[ ] 2. GREEN  - Write the minimum code needed to pass the test
[ ] 3. REFACTOR - Improve code quality while keeping the tests passing
```

### 1.2 Commit Message Rules

```bash
# RED stage
git commit -m "test: add failing test for [feature]"

# GREEN stage
git commit -m "feat: implement [feature] to pass tests"

# REFACTOR stage
git commit -m "refactor: improve [feature] implementation"
```

---

## 2. File Structure Rules

### 2.1 Co-located Tests (Mandatory)

**Rule**: every source file must have a `.test.ts` file in the same location

```
src/actions/apps.ts         -> src/actions/apps.test.ts        ✅
src/lib/services/foo.ts     -> src/lib/services/foo.test.ts    ✅
src/components/Bar.tsx      -> src/components/Bar.test.tsx     ✅
```

### 2.2 Test File Naming

| Source File    | Test File           |
| -------------- | ------------------- |
| `utils.ts`     | `utils.test.ts`     |
| `use-apps.ts`  | `use-apps.test.ts`  |
| `app-card.tsx` | `app-card.test.tsx` |

---

## 3. Code Quality Rules

### 3.1 File Length Limit: 500 Lines

- **Maximum**: 500 lines (refactoring is mandatory beyond this)
- **Recommended**: 300 lines or fewer
- **When approaching 400 lines**: draw up a plan to split the file

```typescript
// How to split
// 1. Helper functions -> extract into a separate file
// 2. Type definitions -> move into types.ts
// 3. Constants -> move into constants.ts
// 4. Large components -> split into child components
```

### 3.2 Coverage Targets

| Area                                 | Minimum Coverage | Priority |
| ------------------------------------ | ---------------- | -------- |
| Server Actions (`src/actions/`)      | 90%              | P0       |
| Services (`src/lib/services/`)       | 90%              | P0       |
| Utility Functions (`src/lib/utils/`) | 95%              | P0       |
| React Hooks (`src/hooks/`)           | 85%              | P1       |
| Components (`src/components/`)       | 80%              | P1       |
| Zustand Stores (`src/stores/`)       | 85%              | P1       |

---

## 4. Naming Conventions

### 4.1 describe Blocks

```typescript
// Pattern: "should [behaviour] when [condition]"
describe("AppCard", () => {
  it("should display app name", () => {}); // ✅
  it("should show status badge when active", () => {}); // ✅
  it("should call onDelete when delete button clicked", () => {}); // ✅

  // Not allowed
  it("renders", () => {}); // ❌ Too vague
  it("handles click", () => {}); // ❌ Outcome not stated
  it("status", () => {}); // ❌ Not a sentence
});
```

### 4.2 Grouping

```typescript
describe("createApp action", () => {
  describe("when valid input", () => {
    it("should create app in database", () => {});
    it("should return success ActionState", () => {});
    it("should revalidate /apps path", () => {});
  });

  describe("when invalid input", () => {
    it("should return validation errors", () => {});
    it("should not create app", () => {});
  });

  describe("when unauthorized", () => {
    it("should return error ActionState", () => {});
  });
});
```

### 4.3 Variable Naming

```typescript
// Test data
const mockApp = { id: "1", name: "Slack" }; // mock + EntityName
const mockApps = [mockApp]; // mock + EntityName + s

// Setup functions
const renderAppCard = (props?: Partial<AppCardProps>) => {}; // render + ComponentName
const createTestApp = (overrides?: Partial<App>) => {}; // createTest + EntityName

// Mock functions
const onDeleteMock = vi.fn(); // eventName + Mock
const handleSubmitMock = vi.fn(); // handlerName + Mock
```

---

## 5. Quality Gates

### 5.1 Mandatory Checks Before Committing

```bash
# Runs automatically (pre-commit hook)
npm run lint-staged

# Run manually (recommended)
npm run quality
```

### 5.2 Mandatory Checks Before a PR

```bash
npm run quality:full
# Runs: lint + type-check + test:coverage
```

### 5.3 CI/CD Quality Gates

| Check           | Command                 | Required |
| --------------- | ----------------------- | -------- |
| Type Check      | `npm run type-check`    | ✅       |
| ESLint          | `npm run lint`          | ✅       |
| Prettier        | `npm run format:check`  | ✅       |
| Unit Tests      | `npm run test`          | ✅       |
| Coverage >= 80% | `npm run test:coverage` | ✅       |

---

## 6. Planning Rules

### 6.1 Checkboxes Are Mandatory

Include a `[ ]` checkbox on every plan item

```markdown
## Work Plan

### Phase 1: Setup

[ ] Create vitest.config.ts
[ ] Update package.json
[x] Create the docs/guide folder (done)

### Phase 2: Implementation

[ ] Implement the App service
[ ] createApp function
[ ] updateApp function
[ ] Write tests
```

### 6.2 Recording Progress

```markdown
## Progress

### 2024-01-15

[x] vitest setup complete - created vitest.config.ts - created vitest.setup.ts - resolution: a Next.js mock had to be added

[ ] Writing tests - createApp: done - updateApp: in progress (validation logic still needs to be added)
```

---

## 7. Code Review Checklist

### 7.1 Tests

```markdown
[ ] Each new source file has a corresponding .test.ts file
[ ] Tests follow the Arrange-Act-Assert pattern
[ ] Test names use the should/when/given pattern
[ ] No .skip tests (if any, an issue link is required)
[ ] Mocks are cleaned up in beforeEach/afterEach
```

### 7.2 Coverage

```markdown
[ ] New code coverage >= 80%
[ ] Happy path + error case tests
[ ] Edge cases documented and tested
```

### 7.3 Quality

```markdown
[ ] Source files are 500 lines or fewer
[ ] shadcn/ui components are used (do not recreate base components)
[ ] TypeScript strict passes
[ ] A JSDoc explanation is mandatory whenever the any type is used
```

---

## 8. Prohibited Practices

### 8.1 Strictly Prohibited

```
❌ Writing feature code without tests
❌ Leaving .skip tests in place
❌ Indiscriminate use of the any type
❌ Files over 500 lines
❌ Recreating shadcn/ui base components (Button, Input, Card, etc.)
❌ Merging PRs with coverage below 80%
```

### 8.2 Points of Caution

```
⚠️ Excessive mocking (real logic needs to be tested)
⚠️ Sharing state between tests
⚠️ Missing await in asynchronous code
⚠️ Hard-coded test data
```

---

## 9. Related Guides

### Multi-tenancy and Error Handling

All data operations must be isolated by `organizationId`:

- [08-multi-tenant-patterns.md](./08-multi-tenant-patterns.md) - Multi-tenant data isolation patterns
- [09-error-handling-strategy.md](./09-error-handling-strategy.md) - ActionState and error handling

### FormData and Audit Logging

Refer to these when implementing Server Actions:

- [10-form-data-patterns.md](./10-form-data-patterns.md) - FormData parsing and Zod validation
- [11-audit-logging.md](./11-audit-logging.md) - Audit log creation patterns

---

## 10. Next Steps

- [03-shadcn-ui-rules.md](./03-shadcn-ui-rules.md) - Component reuse policy
- [04-test-templates.md](./04-test-templates.md) - Test templates
- [05-common-patterns.md](./05-common-patterns.md) - Common test patterns
- [12-git-workflow.md](./12-git-workflow.md) - Git workflow
