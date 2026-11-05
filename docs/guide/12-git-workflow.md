# 12. Git Workflow Guide

This document describes SubHub's Git branching strategy, commit conventions and PR process.

## Table of Contents

1. [Branch Strategy](#1-branch-strategy)
2. [Commit Message Conventions](#2-commit-message-conventions)
3. [Pull Request Process](#3-pull-request-process)
4. [Code Review Guide](#4-code-review-guide)
5. [Vercel Deployment Integration](#5-vercel-deployment-integration)
6. [Checklist](#6-checklist)

---

## 1. Branch Strategy

### 1.1 Branch Structure

```
main (production)
  │
  ├── feature/*     ─ New feature development
  ├── fix/*         ─ Bug fixes
  ├── refactor/*    ─ Refactoring
  ├── docs/*        ─ Documentation work
  └── chore/*       ─ Configuration, dependencies, etc.
```

### 1.2 Branch Naming Conventions

| Prefix      | Purpose                            | Example                              |
| ----------- | ---------------------------------- | ------------------------------------ |
| `feature/`  | New feature                        | `feature/subscription-renewal-alert` |
| `fix/`      | Bug fix                            | `fix/login-redirect-loop`            |
| `refactor/` | Code refactoring                   | `refactor/apps-service-cleanup`      |
| `docs/`     | Documentation work                 | `docs/api-reference`                 |
| `chore/`    | Configuration, build, dependencies | `chore/upgrade-nextjs`               |

### 1.3 Creating a Branch

```bash
# Create a new branch from main
git checkout main
git pull origin main
git checkout -b feature/my-feature

# Push once the work is complete
git push -u origin feature/my-feature
```

### 1.4 Branch Rules

- **main**: Always kept in a deployable state
- **feature branches**: Once work is complete, open a PR → merge → delete
- **No direct pushes to main**: All changes go through a PR

---

## 2. Commit Message Conventions

### 2.1 Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 2.2 Type (Required)

| Type       | Description                        | Example                                      |
| ---------- | ---------------------------------- | -------------------------------------------- |
| `feat`     | New feature                        | `feat(apps): add app owner assignment`       |
| `fix`      | Bug fix                            | `fix(auth): fix redirect on session expiry`  |
| `refactor` | Refactoring (no behaviour change)  | `refactor(apps): separate the service layer` |
| `test`     | Add/update tests                   | `test(apps): add createApp unit tests`       |
| `docs`     | Write/update documentation         | `docs: add TDD guide`                        |
| `chore`    | Build, configuration, dependencies | `chore: update vitest configuration`         |
| `style`    | Code style (formatting, etc.)      | `style: apply prettier`                      |
| `perf`     | Performance improvement            | `perf(db): optimise app list query`          |

### 2.3 Scope (Optional)

The affected module/feature area:

```
apps, subscriptions, users, auth, integrations,
dashboard, reports, settings, api, db, ui
```

### 2.4 Subject (Required)

- English
- 50 characters or fewer
- Imperative mood (start with a verb)
- No trailing full stop

### 2.5 Examples

```bash
# Good examples
feat(apps): add app search filter
fix(auth): fix redirect error after sign-in
refactor(subscriptions): clean up subscription service code
test(apps): add createApp Server Action tests
docs: update development guide documents
chore: upgrade to Next.js 15.5

# Bad examples
updated code                    # Too vague
fix bug                         # Unclear what was fixed
WIP                             # Temporary commit
add app feature                 # Missing type
```

### 2.6 Body (Optional)

- Wrap at 72 characters
- Explain "why" rather than "what"
- Provide the motivation and context for the change

```bash
git commit -m "feat(apps): add app owner assignment

- Assign an owner to each app to clarify accountability
- Owners must be users within the organisation (multi-tenant validation)
- Create the related audit log"
```

---

## 3. Pull Request Process

### 3.1 Checklist Before Opening a PR

```bash
# 1. Code quality checks
npm run quality  # lint + type-check + test

# 2. Check test coverage
npm run test:coverage

# 3. Review the changes
git diff main...HEAD
```

### 3.2 PR Template

```markdown
## Changes

- Summary of what was changed

## Reason for Change

- Why this change is needed

## Testing

- [ ] Unit tests written/updated
- [ ] `npm run quality` passes
- [ ] Manual testing completed locally

## Screenshots (for UI changes)

## Related Issues

Closes #123
```

### 3.3 PR Size Guide

| Size   | Changed Lines | Recommendation     |
| ------ | ------------- | ------------------ |
| Small  | < 100         | Ideal              |
| Medium | 100 - 300     | Appropriate        |
| Large  | 300 - 500     | Consider splitting |
| XL     | > 500         | Must be split      |

### 3.4 PR Creation Commands

```bash
# Using the GitHub CLI
gh pr create --title "feat(apps): app owner assignment" --body "Description..."

# Or create it directly on the web
```

---

## 4. Code Review Guide

### 4.1 Reviewer Checklist

#### Functional Verification

- [ ] Is it implemented according to the requirements?
- [ ] Are edge cases handled?
- [ ] Is error handling appropriate?

#### Code Quality

- [ ] Does it respect the 500-line limit?
- [ ] Does each function/method have a single responsibility?
- [ ] Is naming clear?
- [ ] Are there no unnecessary comments?

#### Testing

- [ ] Are there tests?
- [ ] Are the tests meaningful? (Not written purely for coverage?)
- [ ] Does it achieve 80% or higher coverage?

#### Security

- [ ] Is multi-tenant isolation enforced via organizationId?
- [ ] Is no sensitive information exposed?
- [ ] Are there no vulnerabilities such as SQL injection or XSS?

#### Performance

- [ ] Are there no N+1 queries?
- [ ] Is there no unnecessary data loading?

### 4.2 Review Comment Types

| Prefix         | Meaning                | Response Required |
| -------------- | ---------------------- | :---------------: |
| `[BLOCKER]`    | Must be fixed          |        Yes        |
| `[SUGGESTION]` | Improvement suggestion |        No         |
| `[QUESTION]`   | Question/clarification |      Answer       |
| `[NIT]`        | Minor improvement      |        No         |

### 4.3 Review Examples

```markdown
[BLOCKER] The organizationId filter is missing.
Data belonging to other organisations could be accessed.

[SUGGESTION] Extracting this logic into a separate function
would likely make it easier to test.

[QUESTION] What is the intent of this conditional?
Please confirm whether it handles an edge case.

[NIT] Naming the variable `appData` instead of `data`
would be clearer.
```

---

## 5. Vercel Deployment Integration

### 5.1 Git Author Configuration

**Important**: The Git commit email must match the Vercel account email.

```bash
# Check the current setting
git config user.email

# Set it to the Vercel account email
git config user.email "your-email@example.com"

# Global setting
git config --global user.email "your-email@example.com"
```

### 5.2 Automatic Deployment

| Branch      | Deployment Environment |
| ----------- | ---------------------- |
| `main`      | Production             |
| `feature/*` | Preview                |

### 5.3 Using Preview Deployments

```bash
# A Preview URL is generated automatically when a PR is opened
# https://subhub-<hash>.vercel.app

# Test on Preview, then merge to main
```

### 5.4 When a Deployment Fails

1. Check the build log in the Vercel dashboard
2. Test the build locally: `npm run build`
3. Check the environment variables

---

## 6. Checklist

### When Creating a Branch

- [ ] Branch from an up-to-date main
- [ ] Follow the naming convention (feature/, fix/, etc.)

### When Committing

- [ ] Follow the commit message convention
- [ ] Split commits into meaningful units
- [ ] Avoid WIP commits

### Before Opening a PR

- [ ] `npm run quality` passes
- [ ] Test coverage of 80% or higher
- [ ] PR size of 500 lines or fewer

### When Opening a PR

- [ ] Clear title and description
- [ ] Link to related issues
- [ ] State how it was tested

### During Code Review

- [ ] Confirm multi-tenant isolation
- [ ] Confirm tests exist
- [ ] Confirm code quality rules are followed

### After Merging

- [ ] Delete the branch
- [ ] Confirm the Vercel deployment

---

## Quick Reference

### Frequently Used Commands

```bash
# Create a branch
git checkout -b feature/new-feature

# Commit
git add .
git commit -m "feat(scope): description"

# Push
git push -u origin feature/new-feature

# Create a PR (GitHub CLI)
gh pr create

# Update main, then rebase
git checkout main && git pull
git checkout feature/my-feature
git rebase main

# Continue after resolving conflicts
git add .
git rebase --continue
```

### Commit Type Summary

```
feat     New feature
fix      Bug fix
refactor Refactoring
test     Tests
docs     Documentation
chore    Configuration/dependencies
style    Code style
perf     Performance improvement
```

---

## Related Documents

- [01-tdd-quick-start.md](./01-tdd-quick-start.md) - TDD quick start
- [02-development-principles.md](./02-development-principles.md) - Development principles
- [06-coverage-checklist.md](./06-coverage-checklist.md) - Coverage checklist
- [07-vercel-deployment.md](./07-vercel-deployment.md) - Vercel deployment
