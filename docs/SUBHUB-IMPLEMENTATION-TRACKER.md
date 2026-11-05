# SubHub — Module and Feature Implementation Tracker

**Prepared by:** HelloPixels, Dubai UAE · **Date:** 4 November 2026 · **Repository:** https://github.com/shenulal/SubHub (`main`)

## 1. Verification method

Each capability was verified three ways; a feature is marked **Done** only when all three pass.

| Layer                          | How it was verified                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Implementation**             | Code present for data model, server action, REST endpoint (where the matrix marks Mobile = Yes) and UI; all server-side writes pass through `requirePermission` and the settings registry.                                                                                                                                                                                                                                                                                   |
| **Unit tests**                 | Vitest, co-located; the full suite was run after the dependency upgrade.                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Runtime smoke (Playwright)** | `tests/e2e/smoke.spec.ts` against the production build (`next build` + `next start`) with a seeded QA organisation: every dashboard route renders without an error boundary, every REST endpoint answers, and the core flows run end to end (create subscription → duplicate check → pause/resume/archive/restore → comment/activity; submit approval → approver decision → auto-created subscription → in-app notification; saved view + search; RBAC denial for a member). |

Status legend: ✅ Done · 🟡 Partial (note) · ⏭ Out of scope for the web pass (mobile client)

Totals: **57 of 60 matrix capabilities ✅, 1 🟡 (6.5 cross-device sync: web + API), 2 ⏭ (mobile-only 7.5, 7.6); all 5 added platform requirements ✅.**

## 2. Tracker

### Module 1 — Subscription Tracking

| ID  | Feature                         | Implementation                                                                                                                                                                                  | Unit tests                                                                                       | Runtime check                                                                                                   | Status                                 |
| --- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1.1 | Add subscription manually       | `/subscriptions/new` form with catalog autocomplete, category, payment method, cost centre, tax, tags, custom fields, trial, contract terms; `createSubscription`; `POST /api/v1/subscriptions` | `actions/subscriptions/*` (10 files), `components/subscriptions/*` (13)                          | Page `/subscriptions/new`; API create flow                                                                      | ✅                                     |
| 1.2 | Auto-detect from email receipts | Gmail/Outlook OAuth (`/api/integrations/mailbox/*`), parser, scanner cron `receipt-scan`, review queue `/subscriptions/receipts`, `/settings/mailboxes`                                         | `lib/services/receipts/*` (9), `actions/receipts/*` (2), `components/receipts/*` (6) — 204 tests | Pages `/subscriptions/receipts`, `/settings/mailboxes`; `GET /api/v1/mailboxes`, `/api/v1/receipts/suggestions` | ✅ (live scan needs OAuth credentials) |
| 1.3 | Edit / pause / archive          | `subscription-lifecycle.ts` transitions, detail header actions, `POST /api/v1/subscriptions/[id]/status`                                                                                        | `subscription-lifecycle.test.ts`                                                                 | Flow pause → resume → archive → restore                                                                         | ✅                                     |
| 1.4 | Duplicate detection             | `duplicates.ts` + `similarity.ts`, inline warning on vendor blur, `GET /api/v1/subscriptions/duplicates`                                                                                        | `similarity.test.ts`, `duplicates.test.ts`                                                       | API duplicate check on near-identical name                                                                      | ✅                                     |

### Module 2 — Approvals

| ID  | Feature                         | Implementation                                                                    | Unit tests                                                                 | Runtime check                                             | Status |
| --- | ------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------- | ------ |
| 2.1 | Submit approval request         | `/approvals/new`, `submitApprovalRequest`, `POST /api/v1/approvals`               | `actions/approvals/submit.test.ts`, `lib/services/approval/submit.test.ts` | Flow submit (PENDING)                                     | ✅     |
| 2.2 | Approval policies               | `/settings/approvals` policy builder; `policy-matcher.ts`                         | `policy-matcher.test.ts`, `policies.test.ts`                               | Page `/settings/approvals`; seeded policy applied in flow | ✅     |
| 2.3 | Approver assignment             | `step-resolver.ts` (user / manager / team approver / role), team default approver | `step-resolver.test.ts`, `team-approver.test.ts`                           | Flow routes to named approver                             | ✅     |
| 2.4 | Approve / reject / request info | `decisions.ts`, `POST /api/v1/approvals/[id]/decision`                            | `decision.test.ts`, `request-actions.test.ts`                              | Flow approve with comment                                 | ✅     |
| 2.5 | Request status tracking         | `/approvals`, `/approvals/[id]` timeline                                          | `requests-read.test.ts`, component tests                                   | Pages `/approvals`, `/approvals/[id]`                     | ✅     |
| 2.6 | Escalation & reminders          | cron `approval-reminders`, `reminders.ts`                                         | `reminders.test.ts`                                                        | Cron route registered (`vercel.json`)                     | ✅     |
| 2.7 | Auto-add on approval            | `subscription-creator.ts`                                                         | `subscription-creator.test.ts`                                             | Flow: `subscriptionId` set after final approval           | ✅     |
| 2.8 | Audit log (exportable)          | `audit.ts`, `exportApprovals` CSV                                                 | `audit.test.ts`, `export.test.ts`                                          | `/reports/audit` page                                     | ✅     |

### Module 3 — Reminders & Alerts

| ID  | Feature                                    | Implementation                                                                                | Unit tests                               | Runtime check                              | Status |
| --- | ------------------------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------ | ------ |
| 3.1 | Renewal reminders (configurable lead time) | `reminders.ts`, cron `subscription-reminders`, `ReminderDispatch`                             | `reminders.test.ts`                      | Cron route registered; preference page     | ✅     |
| 3.2 | Trial-ending alerts                        | `trial-alerts.ts`, cron `trial-alerts`                                                        | `trial-alerts.test.ts`                   | Cron route registered; seeded trial record | ✅     |
| 3.3 | Price-change detection                     | `price-change-scan.ts`, `PriceChangeEvent`, `GET/POST /api/v1/price-changes`, receipt scanner | `price-change-scan.test.ts`              | `GET /api/v1/price-changes`                | ✅     |
| 3.4 | Approver renewal alerts                    | `getApproversForSubscription` + copy in reminders                                             | `approvers.test.ts`, `reminders.test.ts` | Covered by reminders unit tests            | ✅     |

### Module 4 — Insights & Reporting

| ID  | Feature                | Implementation                                                                     | Unit tests                                             | Runtime check                          | Status |
| --- | ---------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------- | ------ |
| 4.1 | Spend dashboard        | `getDashboardOverview`, KPI row in base currency, `GET /api/v1/dashboard/overview` | `dashboard-overview.test.ts`, `components/dashboard/*` | Page `/dashboard`; API overview        | ✅     |
| 4.2 | Category breakdown     | `category-breakdown-chart.tsx`, `getCategorySpend` with owner/team filter          | `category-spend.test.ts` (taxonomy + discovery)        | Page `/dashboard`                      | ✅     |
| 4.3 | Trend view             | `/reports/cost` (inherited)                                                        | upstream tests                                         | Page `/reports/cost`                   | ✅     |
| 4.4 | Pending approvals view | `/approvals` inbox + `<PendingApprovalsCard>`                                      | `summary.test.ts`                                      | Pages `/approvals`, `/dashboard`       | ✅     |
| 4.5 | CSV export             | `exportSubscriptions`, `exportCategorySpendCsv`, `exportApprovals`                 | `subscription-export.test.ts`, `export.test.ts`        | Unit-tested; buttons on list/dashboard | ✅     |

### Module 5 — Cancellation

| ID  | Feature             | Implementation                                                                         | Unit tests                                             | Runtime check                        | Status |
| --- | ------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------ | ------ |
| 5.1 | Cancellation guides | catalog `cancellationSteps` (194 vendors), `<CancellationGuide>` on detail tab         | `cancellation-guide.test.tsx`, seed test               | Detail page renders Cancellation tab | ✅     |
| 5.2 | Deep links          | catalog `cancellationUrl` / `billingPortalUrl`, per-app and per-subscription overrides | `catalog.test.ts`, `subscription-cancellation.test.ts` | Detail page                          | ✅     |

### Module 6 — Accounts, Roles & Teams

| ID  | Feature                                | Implementation                                                                    | Unit tests                                                      | Runtime check                                                  | Status                                |
| --- | -------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------- |
| 6.1 | Sign-up / login (Email + Google/Apple) | NextAuth: email OTP, password sign-up, Google, Apple (env-gated)                  | `lib/auth/*.test.ts`, login/signup page tests                   | Credentials login used by the smoke suite                      | ✅ (Apple/Google need client ids)     |
| 6.2 | Roles & permissions                    | `Role`/`Permission` tables, 55-permission catalogue, `requirePermission`, `<Can>` | `lib/rbac/service.test.ts`, `access-control-provider.test.ts`   | `GET /api/v1/me/permissions`; member denied `approvals:decide` | ✅                                    |
| 6.3 | Team workspace                         | invitations, team default approver, `/settings/roles`                             | `invitations.test.ts`, `roles.test.ts`, `team-approver.test.ts` | Pages `/settings/team`, `/settings/roles`                      | ✅                                    |
| 6.4 | Personal + workspace mode              | `isPersonal`, scope switch, `useWorkspaceScope`, scoped queries                   | `scope.test.ts`, `scope-where.test.ts`                          | Header switch present                                          | ✅                                    |
| 6.5 | Cross-device sync                      | Server-authoritative REST API under `/api/v1`                                     | route tests                                                     | All API checks                                                 | 🟡 web + API (mobile client separate) |

### Module 7 — Settings & Platform

| ID  | Feature                  | Implementation                                                                                          | Unit tests                                                 | Runtime check                                      | Status |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------- | ------ |
| 7.1 | Notification preferences | per-user event × channel grid, `/settings/notifications`, `GET/PUT /api/v1/me/notification-preferences` | `preferences.test.ts` (service + action), form test        | Page `/settings/notifications`                     | ✅     |
| 7.2 | Multi-currency           | `Currency` master, `ExchangeRate`, providers, cron `exchange-rates`, `normalizeToBase`                  | `lib/fx/*` (5 files)                                       | `/api/v1/masters/currencies`, `/api/v1/me/context` | ✅     |
| 7.3 | Categories & tags        | see Module 8                                                                                            | —                                                          | —                                                  | ✅     |
| 7.4 | Dark mode                | header toggle re-enabled, system default, appearance page                                               | `appearance` page test                                     | Page `/settings/appearance`; header buttons        | ✅     |
| 7.5 | Home-screen widget       | mobile client                                                                                           | —                                                          | —                                                  | ⏭     |
| 7.6 | Offline access           | mobile client                                                                                           | —                                                          | —                                                  | ⏭     |
| 7.7 | Data deletion & privacy  | `/settings/privacy`: export bundle (ZIP), delete account                                                | `privacy.test.ts`, `privacy-bundle.test.ts`, storage tests | Page `/settings/privacy`                           | ✅     |

### Module 8 — Taxonomy & Organization

| ID  | Feature                 | Implementation                                                              | Unit tests                                                 | Runtime check                                | Status |
| --- | ----------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------- | ------ |
| 8.1 | Hierarchical categories | `Category` tree, seeded defaults (5 parents / 29 children)                  | `categories.test.ts`, `organization-defaults.test.ts`      | `GET /api/v1/taxonomy/categories` (>3 rows)  | ✅     |
| 8.2 | Category management     | `/settings/taxonomy` editor                                                 | `category-tree-editor` tests                               | Page `/settings/taxonomy`                    | ✅     |
| 8.3 | Tagging                 | `Tag`/`SubscriptionTag`, `<TagInput>`, `ensureTags`                         | `tags.test.ts`, `tag-input.test.tsx`                       | Flow: tags persisted on created subscription | ✅     |
| 8.4 | Tag management          | rename / merge / delete with usage counts                                   | `tags.test.ts`, `tag-manager` tests                        | Page `/settings/taxonomy?tab=tags`           | ✅     |
| 8.5 | Custom fields           | `CustomFieldDefinition/Value`, `/settings/custom-fields`, form integration  | `custom-fields.test.ts`, `custom-field-validation.test.ts` | Page `/settings/custom-fields`; API          | ✅     |
| 8.6 | Vendor/service catalog  | 194-vendor seed with logos, pricing, cancellation data; `searchCatalog`     | `saas-catalog.test.ts`, `catalog.test.ts`                  | `/api/v1/search?q=slack`                     | ✅     |
| 8.7 | Auto-categorization     | `suggestCategory` (catalog + keyword rules), `GET /api/v1/taxonomy/suggest` | `auto-categorize.test.ts`, `category-keywords.test.ts`     | Used by create form and receipts accept      | ✅     |

### Module 9 — Discovery & Daily Usability

| ID  | Feature               | Implementation                                                  | Unit tests                                                            | Runtime check                  | Status |
| --- | --------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------ | ------ |
| 9.1 | Global search         | `globalSearch`, Cmd+K palette, `GET /api/v1/search`             | `search.test.ts`, `search-catalog.test.ts`, `command-search.test.tsx` | API search                     | ✅     |
| 9.2 | Filters & saved views | URL-state filters, `SavedView` CRUD, `/api/v1/saved-views`      | `saved-views.test.ts`, `filter-params.test.ts`                        | Flow: create saved view        | ✅     |
| 9.3 | Sort options          | sort by renewal/cost/name/status/category/owner (URL)           | `list-where.test.ts`                                                  | Page `/subscriptions`          | ✅     |
| 9.4 | Calendar view         | `/subscriptions/calendar` with trial/notice markers             | `calendar-extras.test.ts`, calendar component tests                   | Page `/subscriptions/calendar` | ✅     |
| 9.5 | Renewal pipeline view | `/subscriptions/pipeline`, `GET /api/v1/subscriptions/pipeline` | `pipeline-buckets.test.ts`, `pipeline.test.ts`                        | Page + API                     | ✅     |
| 9.6 | Bulk actions          | multi-select bar → `bulkUpdateSubscriptions`                    | `subscription-bulk-bar.test.tsx`, lifecycle tests                     | Page `/subscriptions`          | ✅     |

### Module 10 — Documents & Contract Context

| ID   | Feature                | Implementation                                                              | Unit tests                                                      | Runtime check                  | Status |
| ---- | ---------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------ | ------ |
| 10.1 | Attachments            | `Attachment`, upload/list/delete API, storage providers                     | `attachments.test.ts` (service + action), storage tests         | Detail "Documents" tab renders | ✅     |
| 10.2 | Notes & activity log   | comments + audit timeline, `/api/v1/subscriptions/[id]/{comments,activity}` | `subscription-comments.test.ts`                                 | Flow: comment + activity       | ✅     |
| 10.3 | Contract term tracking | `noticePeriodDays`, `cancellationDeadline`, contract card                   | `contract-terms.test.ts`, `subscription-contract-card.test.tsx` | Detail page                    | ✅     |
| 10.4 | Notice-period alerts   | `notice-period-alerts.ts`, cron                                             | `notice-period-alerts.test.ts`                                  | Cron route registered          | ✅     |

### Module 11 — Communication & Self-Service

| ID   | Feature                     | Implementation                                                 | Unit tests                                                     | Runtime check                                                                 | Status |
| ---- | --------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------ |
| 11.1 | Unified notification center | persistent `Notification`, bell, `/notifications`, read APIs   | `center.test.ts`, `inbox.test.ts`, bell/centre component tests | Page `/notifications`; unread-count API; approval flow creates a notification | ✅     |
| 11.2 | Digest mode                 | `weeklyDigest.ts` + `digest-content.ts`, configurable day/time | `weeklyDigest.test.ts`                                         | Cron route registered                                                         | ✅     |
| 11.3 | In-app onboarding checklist | `<OnboardingChecklist>` on dashboard                           | `onboarding.test.ts`, component test                           | Page `/dashboard`                                                             | ✅     |
| 11.4 | Contextual help             | `<HelpHint>` used on policies, preferences, custom fields      | `help-hint.test.tsx`                                           | Pages render                                                                  | ✅     |

### Module 12 — Platform requirements added on 4 November

| #   | Requirement                             | Implementation                                                                                                                                     | Unit tests                                                        | Runtime check                         | Status |
| --- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------- | ------ |
| A   | Currency master + online exchange rates | `Currency` (41), `ExchangeRate`, providers (Frankfurter, open.er-api, exchangerate.host, Google Finance best-effort, manual), cron                 | `lib/fx/*`                                                        | `/api/v1/masters/currencies`          | ✅     |
| B   | Masters for analytics data              | countries (49), tax rates, cost centres, payment methods, billing cycles, categories, tags, custom fields, catalog, templates; `/settings/masters` | `actions/platform/masters` tests, `organization-defaults.test.ts` | Page `/settings/masters`; master APIs | ✅     |
| C   | No hard-coding; configurable settings   | registry (87 keys / 12 groups), `/settings/workspace/[group]`, `/super-admin/settings`                                                             | `lib/settings/service.test.ts`, settings form tests               | Pages `/settings/workspace/*`         | ✅     |
| D   | Application RBAC                        | roles/permissions tables, server enforcement, UI gating, `/settings/roles`                                                                         | `lib/rbac/service.test.ts`, `roles.test.ts`, API middleware tests | member denial check; `/api/v1/roles`  | ✅     |
| E   | Other operational settings              | time zone, locale, fiscal year, security, retention, documents, integrations, discovery, platform                                                  | registry default-validity test                                    | Pages render                          | ✅     |

## 3. Technology stack and security actions in this pass

| Item                                          | Action                                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Next.js                                       | 15.5.7 → **15.5.29** (critical advisory fixed)                                                                                  |
| next-auth / @auth/core / @auth/prisma-adapter | → **5.0.0-beta.32 / 0.41.3 / 2.11.3** (critical advisory fixed)                                                                 |
| zod                                           | 3 → **4.6.7** (high advisory fixed; 27 files migrated)                                                                          |
| @hookform/resolvers                           | → 5.9.2                                                                                                                         |
| Remaining advisories                          | moderate/low only, all transitive (next-intl v3→v4, exceljs/archiver chain, resend) — tracked for a later major-version pass    |
| Secrets                                       | pre-commit secret scan (`scripts/check-secrets.mjs`), `docs/SECURITY-PRACTICES.md`, env files ignored, tokens encrypted at rest |
| Headers                                       | nosniff, frame deny, referrer policy, permissions policy, HSTS in production                                                    |

## 4. Verification results

| Check                                                        | Result (4 November 2026, after dependency upgrades)                                                                                                                                                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production build (`next build`)                              | Passes, 185 routes                                                                                                                                                                                                                                            |
| Strict type-check (`tsc --noEmit`)                           | 0 errors                                                                                                                                                                                                                                                      |
| Unit tests (Vitest)                                          | 3,534 tests: **3,405 pass**, 38 skipped, 91 fail — all 91 are pre-existing upstream failures (baseline 124); 8 upstream suites repaired; **0 regressions**                                                                                                    |
| Runtime smoke (Playwright, production server, seeded QA org) | **50 of 50 pass**: 43 dashboard/settings routes render without errors, 18 REST endpoints answer, 5 end-to-end flows (subscription lifecycle, approval decision → auto-created subscription → notification, saved view + search, RBAC denial, header controls) |
| Security audit (`npm audit --omit=dev`)                      | 0 critical, 0 high on direct dependencies after upgrades; remaining advisories are moderate/low transitive (documented in section 3)                                                                                                                          |
| Secret scan                                                  | Tracked tree clean; pre-commit guard active                                                                                                                                                                                                                   |

How to reproduce: `npm run build && npm run seed:smoke && E2E_PORT=3100 npm run test:e2e` (the suite starts `next start` itself), `npm run test`, `npm run type-check`, `npm run audit:prod`.

## 5. Additions on 5 November 2026

| Area            | Delivered                                                                                                                                                                                                                      | Status             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| Design          | Materio design system (tokens, primitives, shell, auth screens); Lato typography (400 regular / 700 titles, 12px minimum)                                                                                                      | ✅                 |
| Language        | English-only; Korean locale and texts removed (functional Korean third-party literals kept and listed)                                                                                                                         | ✅                 |
| Branding        | SaasLens / "SaaS Management Platform" renamed to SubHub                                                                                                                                                                        | ✅                 |
| Master data     | `/settings/masters` hub: currencies, countries, tax rates, cost centres, payment methods, billing cycles, categories, tags, custom fields, vendor catalog — create / edit / archive behind RBAC                                | ✅                 |
| Inline creation | "+ Create" in app, category, team, user (invite), tag, cost centre, payment method, tax rate and currency pickers; "+ New" quick-create menu (key `N`) and ⌘K "Create new" group                                               | ✅                 |
| Dropdowns       | Every dropdown searchable; filters and multi-value fields use multi-select end to end (URL, API, saved views)                                                                                                                  | ✅                 |
| Deployment      | `SUBHUB_DEPLOYMENT_MODE`: single-tenant (on-premise / self-hosted, default) and SaaS (multi-tenant, platform-only permissions for cross-tenant data); Docker compose with migrate job and scheduler — see `docs/DEPLOYMENT.md` | ✅                 |
| Billing cycles  | Creatable billing cycles need the cycle enum converted to a master (≈114 files)                                                                                                                                                | ⏭ separate change |

Verification for this release: `tsc` 0 errors; Vitest 3,655 pass / 78 fail (all pre-existing, none worse); `next build` 188 routes; Playwright smoke 50 / 50 in **both** single-tenant and SaaS mode.
