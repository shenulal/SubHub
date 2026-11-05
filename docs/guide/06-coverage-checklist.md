# Coverage Checklist

> **Mandatory checks before raising a PR**

---

## 1. Quick Commands

```bash
# Run the tests
npm test

# Generate a coverage report
npm run test:coverage

# Open the HTML report
open coverage/index.html

# Run the full quality check
npm run quality:full
```

---

## 2. Coverage Requirements

### 2.1 Overall Target: 80%

```
✅ Statements: 80%
✅ Branches: 80%
✅ Functions: 80%
✅ Lines: 80%
```

### 2.2 Targets by Directory

| Directory           | Minimum Coverage | Priority       |
| ------------------- | ---------------- | -------------- |
| `src/actions/`      | 90%              | P0 - Mandatory |
| `src/lib/services/` | 90%              | P0 - Mandatory |
| `src/lib/utils.ts`  | 95%              | P0 - Mandatory |
| `src/hooks/`        | 85%              | P1 - High      |
| `src/stores/`       | 85%              | P1 - High      |
| `src/components/`   | 80%              | P1 - High      |
| `src/app/api/`      | 80%              | P2 - Medium    |

---

## 3. Pre-PR Checklist

### 3.1 Test Files

```markdown
[ ] Every new source file has a .test.ts file
[ ] Test files sit next to their source files (co-located)
[ ] The tests actually run (npm test passes)
```

### 3.2 Coverage

```markdown
[ ] Run npm run test:coverage
[ ] Overall coverage is 80% or higher
[ ] Coverage of newly added code has been checked
[ ] Uncovered Lines have been reviewed
```

### 3.3 Test Quality

```markdown
[ ] Happy path (normal case) tests
[ ] Error case tests
[ ] Edge case (boundary case) tests
[ ] Test names are clear (should/when pattern)
```

---

## 4. What to Test

### 4.1 Mandatory Test Targets

```typescript
// ✅ Server Actions
// - All input validation
// - Success cases
// - Failure cases (validation, DB error, no permission)
// - Verify the revalidatePath call

// ✅ Business logic
// - Calculation functions
// - Data transformation functions
// - Filter/sort logic

// ✅ Custom hooks
// - All states (loading, error, success)
// - State-changing functions
// - Re-render optimisation

// ✅ Form validation
// - Validation rules for each field
// - Full form submission
// - Error message display

// ✅ Components
// - Data rendering
// - Conditional rendering
// - Event handlers
// - Loading/error states
```

### 4.2 Tests That May Be Skipped (Excluded from Coverage)

```typescript
// ⏭️ shadcn/ui component internal behaviour
// - Whether a Button is clickable
// - Opening/closing a Dialog
// - Selecting a Select option

// ⏭️ Next.js internal behaviour
// - Router behaviour
// - Image component

// ⏭️ Static JSX
// - Pure markup with no logic
// - Style-only components

// ⏭️ Type definitions
// - interface
// - type alias

// ⏭️ Configuration files
// - vitest.config.ts
// - next.config.ts
```

---

## 5. Resolving Uncovered Lines

### 5.1 Review the Report

```bash
npm run test:coverage
open coverage/index.html
```

### 5.2 Common Uncovered Patterns

```typescript
// Pattern 1: Error handling
// Problem: the catch block is not covered
try {
  await riskyOperation();
} catch (error) {
  console.error(error); // ← Uncovered
  return { error: "Failed" };
}

// Fix: add a test that triggers the error
it("should handle error", async () => {
  vi.mocked(riskyOperation).mockRejectedValue(new Error("Test error"));
  const result = await functionUnderTest();
  expect(result.error).toBe("Failed");
});
```

```typescript
// Pattern 2: Conditional rendering
// Problem: the else branch is not covered
function Component({ isLoading }) {
  if (isLoading) {
    return <Spinner />;
  }
  return <Content />;  // ← Uncovered
}

// Fix: test both cases
it('should show spinner when loading', () => {
  render(<Component isLoading={true} />);
  expect(screen.getByTestId('spinner')).toBeInTheDocument();
});

it('should show content when not loading', () => {
  render(<Component isLoading={false} />);
  expect(screen.getByTestId('content')).toBeInTheDocument();
});
```

```typescript
// Pattern 3: Early return
// Problem: the validation-failure case is not covered
function validate(data) {
  if (!data.name) {
    return { error: "Name required" }; // ← Uncovered
  }
  return { success: true };
}

// Fix: add a test for the failure case
it("should return error for missing name", () => {
  const result = validate({});
  expect(result.error).toBe("Name required");
});
```

---

## 6. Coverage Exceptions

### 6.1 Intentional Exclusions

```typescript
// Exclude in vitest.config.ts
coverage: {
  exclude: [
    'src/app/layout.tsx',      // Next.js layout
    'src/app/**/loading.tsx',  // Loading components
    'src/app/**/error.tsx',    // Error components
    'src/types/**',            // Type definitions
  ],
}
```

### 6.2 Inline Exclusions (Use Sparingly)

```typescript
// Exclude a specific line (only when truly necessary)
/* v8 ignore next */
console.log("debug only");

// Exclude a block
/* v8 ignore start */
if (process.env.NODE_ENV === "development") {
  // Development-only code
}
/* v8 ignore stop */
```

---

## 7. CI/CD Coverage Checks

### 7.1 GitHub Actions

```yaml
# .github/workflows/ci.yml
- name: Run Tests with Coverage
  run: npm run test:coverage

- name: Check Coverage Threshold
  run: |
    COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
    if (( $(echo "$COVERAGE < 80" | bc -l) )); then
      echo "Coverage $COVERAGE% is below 80% threshold"
      exit 1
    fi
```

### 7.2 Pre-commit Hook (Optional)

```bash
# .husky/pre-push
npm run test:coverage
```

---

## 8. Tips for Improving Coverage

### 8.1 Incremental Improvement

```markdown
Week 1: Reach 90% on core Server Actions
Week 2: Reach 90% on the service layer
Week 3: Reach 80% on components
Week 4: Maintain 80% overall and stabilise
```

### 8.2 New Code First

```markdown
- All newly written code must include tests
- Add tests to existing code whenever it is modified
- When fixing a bug, add a test that reproduces that bug
```

### 8.3 Alongside Refactoring

```markdown
- Write tests first when refactoring code
- Refactor only after confirming the tests pass
- Re-run the tests after refactoring
```

---

## 9. Interpreting the Coverage Report

### 9.1 Metric Definitions

| Metric     | Description                                                    |
| ---------- | -------------------------------------------------------------- |
| Statements | Percentage of statements executed                              |
| Branches   | Percentage of conditional branches executed (if/else, ternary) |
| Functions  | Percentage of functions called                                 |
| Lines      | Percentage of code lines executed                              |

### 9.2 Priorities

```
1. Branches - Most important (test every condition)
2. Functions - Confirm every function is called
3. Lines - Identify code that never executes
4. Statements - Check overall coverage
```

---

## 10. Summary Checklist

### Final Checks Before Submitting a PR

```markdown
[ ] npm run quality:full passes
[ ] Overall coverage is 80% or higher
[ ] Tests exist for the new code
[ ] Test files sit next to their source files
[ ] No .skip tests
[ ] All tests pass
```

---

## Related Documents

- [01-tdd-quick-start.md](./01-tdd-quick-start.md) - Getting started with TDD
- [02-development-principles.md](./02-development-principles.md) - Development principles
- [04-test-templates.md](./04-test-templates.md) - Test templates
- [08-multi-tenant-patterns.md](./08-multi-tenant-patterns.md) - Multi-tenant test patterns
- [11-audit-logging.md](./11-audit-logging.md) - Audit log test patterns
- [12-git-workflow.md](./12-git-workflow.md) - Git workflow and PR process
