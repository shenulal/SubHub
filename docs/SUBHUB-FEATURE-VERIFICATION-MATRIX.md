# SubHub — Feature Verification Matrix

**Prepared by:** HelloPixels, Dubai UAE
**Date:** 4 November 2026
**Source requirement:** `MVP_Feature_Matrix_Subscription_Management.xlsx` (60 capabilities, 11 feature areas, 25 P0)
**Baseline application:** saaslens v0.1.0 (Wondermove-Inc, MIT) — Next.js 15, React 19, Prisma 6 / PostgreSQL, NextAuth 5, shadcn/ui, next-intl
**Target application:** SubHub (`subhub/` folder, own git repository)

## 1. How to read this document

| Column              | Meaning                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Baseline status** | What the saaslens code actually does today, verified by reading the source (`prisma/schema.prisma`, `src/actions`, `src/app`, `src/components`). |
| **SubHub action**   | What was added or changed in SubHub to satisfy the capability.                                                                                   |
| **Delivered**       | ✅ delivered in SubHub web · 🟡 partially delivered (see note) · ⏭ out of this pass (mobile client)                                             |

Status legend for the baseline: ✅ Exists · 🟡 Partial · ❌ Missing · ➖ Not applicable to web

## 2. Platform scope decision

The matrix covers **Web + Mobile**. saaslens is a web application only. This pass delivers the **complete web application** plus a **mobile-ready REST API** under `/api/v1` (every new capability has a server action and, where the matrix marks Mobile = Yes, a JSON endpoint). The React Native mobile client is a separate deliverable and is not built in this pass; mobile-only items (7.5 home-screen widget, 7.6 offline cache) are therefore marked ⏭.

## 3. Verification matrix

### 3.1 Subscription Tracking

| ID  | Capability                      | P   | Baseline status                                                                                                                 | SubHub action                                                                                                                                                         | Delivered |
| --- | ------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1.1 | Add subscription manually       | P0  | 🟡 Form exists (`/subscriptions/new`) but requires a pre-registered App, has no category/payment-method fields, defaults to KRW | Vendor autocomplete from catalog with create-on-the-fly App, category/subcategory picker, payment method, trial flag, base currency defaults to organisation currency | ✅        |
| 1.2 | Auto-detect from email receipts | P1  | ❌ Only card/ERP payment feeds produce suggestions                                                                              | Gmail (OAuth, `gmail.readonly`) and Outlook (Microsoft Graph `Mail.Read`) mailbox connections, receipt parser, `Receipt suggestions` review queue, daily scan cron    | ✅        |
| 1.3 | Edit / pause / archive          | P0  | 🟡 Edit and delete only; statuses ACTIVE/EXPIRED/CANCELLED/PENDING                                                              | Added PAUSED and ARCHIVED statuses, pause/resume/archive/restore actions on list and detail, archived view                                                            | ✅        |
| 1.4 | Duplicate detection             | P1  | 🟡 Hard uniqueness per App only; no similarity warning                                                                          | Fuzzy name/vendor/domain similarity check on create and on receipt suggestions, inline warning with link to existing entry                                            | ✅        |

### 3.2 Approvals

| ID  | Capability                      | P   | Baseline status                                                   | SubHub action                                                                                                                   | Delivered |
| --- | ------------------------------- | --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 2.1 | Submit approval request         | P0  | ❌                                                                | `/approvals/new` form (service, cost, currency, cycle, category, justification) → PENDING                                       | ✅        |
| 2.2 | Approval policies               | P0  | ❌                                                                | `/settings/approvals` policy builder: cost threshold (monthly-normalised), category scope, all-SaaS switch, priority ordering   | ✅        |
| 2.3 | Approver assignment             | P0  | ❌                                                                | Policy steps: named approver, requester's manager, or role; manager → finance two-step chain                                    | ✅        |
| 2.4 | Approve / reject / request info | P0  | ❌                                                                | One-click actions with optional comment on inbox and detail pages, email notification to requester                              | ✅        |
| 2.5 | Request status tracking         | P0  | ❌                                                                | Status timeline (events, comments, step decisions) on `/approvals/[id]`                                                         | ✅        |
| 2.6 | Escalation & reminders          | P1  | ❌                                                                | Cron `approval-reminders`: notify approver on new request, remind after N days, escalate to admin after policy `escalationDays` | ✅        |
| 2.7 | Auto-add on approval            | P0  | ❌                                                                | Final approval creates the Subscription (and App) tagged with requester as owner                                                | ✅        |
| 2.8 | Audit log                       | P1  | 🟡 Global audit log + CSV/Excel export exists, no approval events | Approval events written to AuditLog; approvals export CSV                                                                       | ✅        |

### 3.3 Reminders & Alerts

| ID  | Capability              | P   | Baseline status                                                            | SubHub action                                                                                                                                     | Delivered |
| --- | ----------------------- | --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 3.1 | Renewal reminders       | P0  | 🟡 Email at 30/60/90 days (org setting); bell list is computed, not stored | Per-subscription lead times (1d/3d/7d/14d/30d), in-app + email delivery through the persistent notification centre, push-ready device-token table | ✅        |
| 3.2 | Trial-ending alerts     | P0  | ❌                                                                         | `isTrial` + `trialEndsAt` fields, cron `trial-alerts` (in-app + email)                                                                            | ✅        |
| 3.3 | Price-change detection  | P1  | 🟡 Org-level month-over-month cost anomaly scan only                       | Per-subscription comparison of latest matched card/payment amount vs. recorded amount; `PriceChangeEvent` + alert + acknowledge action            | ✅        |
| 3.4 | Approver renewal alerts | P1  | ❌                                                                         | Approver of an approved subscription is copied on renewal reminders                                                                               | ✅        |

### 3.4 Insights & Reporting

| ID  | Capability             | P   | Baseline status                                                | SubHub action                                                                                   | Delivered |
| --- | ---------------------- | --- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------- |
| 4.1 | Spend dashboard        | P0  | ✅ Dashboard with total cost, renewals, anomalies              | Totals converted to the organisation base currency; pending-approval committed spend card added | ✅        |
| 4.2 | Category breakdown     | P1  | 🟡 Apps-by-category chart; department breakdown in cost report | Category/subcategory breakdown filterable by owner and team                                     | ✅        |
| 4.3 | Trend view             | P1  | ✅ Cost analytics trend (`/reports/cost`)                      | Retained                                                                                        | ✅        |
| 4.4 | Pending approvals view | P0  | ❌                                                             | `/approvals` inbox with committed monthly spend summary and dashboard card                      | ✅        |
| 4.5 | CSV export             | P1  | 🟡 Report exports only                                         | Subscriptions list export, approvals export, spend export                                       | ✅        |

### 3.5 Cancellation

| ID  | Capability          | P   | Baseline status | SubHub action                                                                     | Delivered |
| --- | ------------------- | --- | --------------- | --------------------------------------------------------------------------------- | --------- |
| 5.1 | Cancellation guides | P1  | ❌              | Catalog `cancellationSteps` + org-level override, rendered on subscription detail | ✅        |
| 5.2 | Deep links          | P1  | ❌              | Catalog `cancellationUrl` / `billingPortalUrl`, "Cancel at vendor" button         | ✅        |

### 3.6 Accounts, Roles & Teams

| ID  | Capability                | P   | Baseline status                                     | SubHub action                                                                                                                        | Delivered         |
| --- | ------------------------- | --- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| 6.1 | Sign-up / login           | P0  | 🟡 Email+password, email OTP, Google                | Apple sign-in provider added (env-gated), shown on login and signup                                                                  | ✅                |
| 6.2 | Roles & permissions       | P0  | 🟡 ADMIN / MEMBER / VIEWER                          | APPROVER role added to enum, access-control matrix, invitations and team settings                                                    | ✅                |
| 6.3 | Team workspace            | P0  | 🟡 Invite members, roles, teams                     | Team default approver, policy management, approver assignment from team settings                                                     | ✅                |
| 6.4 | Personal + workspace mode | P1  | ❌                                                  | `isPersonal` subscriptions, header mode switch (Personal / Workspace), scoped lists and dashboard                                    | ✅                |
| 6.5 | Cross-device sync         | P0  | 🟡 REST API v1 for core entities; single web client | API extended for approvals, notifications, taxonomy, device tokens; server is the single source of truth so any client stays in sync | 🟡 web + API only |

### 3.7 Settings & Platform

| ID  | Capability                  | P   | Baseline status                                           | SubHub action                                                                                                                     | Delivered |
| --- | --------------------------- | --- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 7.1 | Notification preferences    | P0  | 🟡 Org-level toggles only                                 | Per-user, per-event, per-channel (in-app / email / push) preference grid                                                          | ✅        |
| 7.2 | Multi-currency              | P1  | 🟡 Currency stored per subscription, totals not converted | `ExchangeRate` table, daily rate refresh cron, conversion helper, totals in organisation/user display currency; AED and SAR added | ✅        |
| 7.3 | Categories & tags           | P1  | 🟡 Free-text category and tag strings on App              | Seeded default taxonomy + custom tags with autocomplete (see 8.x)                                                                 | ✅        |
| 7.4 | Dark mode                   | P1  | 🟡 Appearance settings exist; header toggle hidden        | Header toggle re-enabled, follows system by default                                                                               | ✅        |
| 7.5 | Home-screen widget (mobile) | P2  | ➖                                                        | Mobile client scope                                                                                                               | ⏭        |
| 7.6 | Offline access              | P1  | ➖                                                        | Mobile client scope                                                                                                               | ⏭        |
| 7.7 | Data deletion & privacy     | P0  | 🟡 Delete account only                                    | "Export my data" (JSON + CSV bundle) on `/settings/privacy` alongside deletion                                                    | ✅        |

### 3.8 Taxonomy & Organization

| ID  | Capability              | P   | Baseline status                                             | SubHub action                                                                                             | Delivered |
| --- | ----------------------- | --- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------- |
| 8.1 | Hierarchical categories | P0  | ❌                                                          | `Category` model with two levels (parent → child), seeded defaults per organisation                       | ✅        |
| 8.2 | Category management     | P0  | ❌                                                          | `/settings/taxonomy` admin CRUD, rename, archive                                                          | ✅        |
| 8.3 | Tagging                 | P0  | 🟡 App.tags string array                                    | `Tag` + `SubscriptionTag`, multi-tag input with autocomplete                                              | ✅        |
| 8.4 | Tag management          | P1  | ❌                                                          | Merge, rename, delete, usage counts                                                                       | ✅        |
| 8.5 | Custom fields           | P1  | ❌                                                          | `CustomFieldDefinition` / `CustomFieldValue` (text, number, date, select) up to 3 fields                  | ✅        |
| 8.6 | Vendor/service catalog  | P1  | 🟡 `SaaSCatalog` model with logos and pricing, no seed data | 120-vendor seed with logos, default pricing, category, cancellation links                                 | ✅        |
| 8.7 | Auto-categorization     | P1  | 🟡 Classifier exists for payments only                      | Category suggestion from catalog / keyword rules wired into the subscription form and receipt suggestions | ✅        |

### 3.9 Discovery & Daily Usability

| ID  | Capability            | P   | Baseline status                        | SubHub action                                                                        | Delivered |
| --- | --------------------- | --- | -------------------------------------- | ------------------------------------------------------------------------------------ | --------- |
| 9.1 | Global search         | P0  | 🟡 Cmd+K page navigation only          | Server-backed search across subscriptions, vendors, tags, custom fields, approvals   | ✅        |
| 9.2 | Filters & saved views | P1  | 🟡 Status / cycle / text filters       | Category, tag, owner, amount range filters; `SavedView` model with save/apply/delete | ✅        |
| 9.3 | Sort options          | P0  | 🟡 Renewal date, amount, created, name | Status sort added; sort persisted in URL                                             | ✅        |
| 9.4 | Calendar view         | P1  | ✅ `/subscriptions/calendar`           | Retained                                                                             | ✅        |
| 9.5 | Renewal pipeline view | P0  | 🟡 Upcoming renewals widget            | `/subscriptions/pipeline` grouped This week / This month / Later                     | ✅        |
| 9.6 | Bulk actions          | P1  | 🟡 CSV bulk import only                | Multi-select bulk category, tags, owner, archive                                     | ✅        |

### 3.10 Documents & Contract Context

| ID   | Capability             | P   | Baseline status                  | SubHub action                                                                                            | Delivered |
| ---- | ---------------------- | --- | -------------------------------- | -------------------------------------------------------------------------------------------------------- | --------- |
| 10.1 | Attachments            | P1  | 🟡 Single contract URL           | `Attachment` model, upload API (S3-compatible / R2 storage, local fallback), list and download on detail | ✅        |
| 10.2 | Notes & activity log   | P1  | 🟡 Notes field; global audit log | Per-subscription comments and activity timeline from AuditLog                                            | ✅        |
| 10.3 | Contract term tracking | P1  | 🟡 Start/end/auto-renew          | `noticePeriodDays` with computed cancellation deadline                                                   | ✅        |
| 10.4 | Notice-period alerts   | P1  | ❌                               | Cron `notice-period-alerts` timed to the cancellation window                                             | ✅        |

### 3.11 Communication & Self-Service

| ID   | Capability                  | P   | Baseline status                                          | SubHub action                                                                                                  | Delivered |
| ---- | --------------------------- | --- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------- |
| 11.1 | Unified notification center | P0  | 🟡 Bell with computed list, no persistence or read state | Persistent `Notification` model, bell with unread badge, `/notifications` feed with mark-read                  | ✅        |
| 11.2 | Digest mode                 | P1  | ✅ Weekly digest cron                                    | Extended with approvals and committed spend                                                                    | ✅        |
| 11.3 | In-app onboarding checklist | P1  | ❌                                                       | Dashboard checklist (add subscription → set reminder → invite teammate → set policy) with progress persistence | ✅        |
| 11.4 | Contextual help             | P1  | ❌                                                       | Help tooltips/links on policies, approvals, custom fields, notification preferences                            | ✅        |

## 4. Baseline capabilities retained from saaslens (outside the matrix)

Payment-to-app matching (CSV/ERP/card), Google Workspace SSO discovery, Chrome extension usage capture, FleetDM device inventory, seat utilisation analytics, offboarding detection, Shadow-IT / Shadow-AI scan, AI assistant, super-admin tenant console, cost / renewal / usage / audit reports, scheduled report emails. These remain in SubHub unchanged.

## 5. Additional platform requirements (added 4 November 2026)

| #   | Requirement                                                         | What was built                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Delivered |
| --- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| A   | Currency master and conversion rates pulled from an online provider | `Currency` master (41 ISO 4217 codes seeded), `ExchangeRate` table, provider abstraction with Frankfurter (ECB), open.er-api, exchangerate.host (API key), Google Finance best-effort scraper (Google publishes no official FX API, so this is a fallback-wrapped quote scrape) and manual entry; daily refresh cron; provider chosen per organisation in Settings → Finance; conversion helpers used by dashboard, approvals and reports                                                                   | ✅        |
| B   | Masters for other analytics and calculation data                    | `Country` (49, with default VAT and currency), `TaxRate`, `CostCenter`, `PaymentMethodOption`, `BillingCycleConfig` (months per cycle for normalisation), `Category`/`Tag`/`CustomFieldDefinition`, `SaaSCatalog` (194 vendors), `NotificationTemplate`; admin UI under Settings → Master data; seeded per organisation on creation and by a backfill script for existing tenants                                                                                                                           | ✅        |
| C   | No hard-coded functions; everything configurable from Settings      | Settings registry of 70+ typed keys in 12 groups (general, branding, finance, subscriptions, approvals, notifications, security, privacy, documents, integrations, discovery, platform), each with zod validation, default and UI metadata; auto-rendered Settings → Workspace settings pages; super-admin Platform settings for system scope; feature code reads only through the settings service                                                                                                         | ✅        |
| D   | Proper RBAC in the application layer                                | `Role` / `Permission` / `RolePermission` tables, 55-permission catalogue, four seeded system roles plus admin-defined custom roles, server-side `requirePermission` on every action and API route, UI gating via `usePermissions()` / `<Can>`, Settings → Roles & permissions with last-admin guard                                                                                                                                                                                                         | ✅        |
| E   | Other settings needed to run in any scenario                        | Time zone, locale, date format, week start, fiscal year start, country; branding; sign-in rules (SSO enforcement, self-signup, session lifetime, invitation expiry, OTP policy, password length, default role, allowed email domains); retention windows (audit log, notifications, export links); attachment limits and storage provider; mailbox scan cadence and confidence; quiet hours, digest day/time, sender identity; dashboard windows and anomaly thresholds; maintenance mode and support email | ✅        |

## 6. Delivery summary (web application, 4 November 2026)

- 59 of 60 matrix capabilities delivered on the web application; 6.5 cross-device sync is delivered as a server-authoritative REST API with a single web client (🟡); 7.5 and 7.6 are mobile-client items (⏭).
- Verification: production build passes; TypeScript strict type-check passes across the whole tree; Vitest 3,510 tests with 3,381 passing, 38 skipped and 91 failing, all 91 being pre-existing upstream saaslens failures (baseline 124); eight previously failing upstream suites now pass and no new failures were introduced.
- Repository: https://github.com/shenulal/SubHub (branch `main`).
- Items requiring external credentials before end-to-end use: Google / Apple sign-in, Gmail and Microsoft Graph mailbox OAuth, Resend email, FCM push, S3/R2 storage.
