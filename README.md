<p align="center">
  <img src="public/logo.svg" alt="SubHub" width="220" />
</p>

<p align="center">
  <strong>SubHub — subscription management for teams.</strong><br/>
  Track every subscription, route purchases through approvals, get reminded before renewals, trials and cancellation windows, and see spend in your own currency.
</p>

<p align="center">
  Built by <strong>HelloPixels</strong>, Dubai UAE · Derived from <a href="https://github.com/Wondermove-Inc/saaslens">saaslens</a> (MIT)
</p>

---

## What SubHub does

| Area                        | Capabilities                                                                                                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Subscription tracking**   | Manual add with vendor catalog autocomplete, edit / pause / archive, duplicate detection, trial tracking, contract terms + notice periods, attachments, notes and activity log, personal vs. workspace subscriptions                                                                                               |
| **Email receipt detection** | Connect Gmail or Outlook (read-only); recurring charges are parsed into suggestions you can accept, link or dismiss                                                                                                                                                                                                |
| **Approvals**               | Policies by cost threshold / category, named approvers, manager → finance chains, approve / reject / request info with comments, reminders and escalation, auto-create the subscription on approval, exportable audit trail                                                                                        |
| **Reminders & alerts**      | Configurable lead times (1/3/7/14/30 days), trial-ending, price-change, notice-period alerts; approvers copied on renewals; in-app, email and push-ready                                                                                                                                                           |
| **Insights**                | Spend dashboard in the organisation base currency, category / subcategory breakdown, trends, pending-approval committed spend, CSV exports                                                                                                                                                                         |
| **Taxonomy & masters**      | Two-level categories, tags with merge/rename, custom fields, 120+ vendor catalog with logos, default pricing and cancellation guides, auto-categorisation                                                                                                                                                          |
| **Discovery**               | Global Cmd+K search, filters + saved views, sort, calendar, renewal pipeline (this week / this month / later), bulk actions                                                                                                                                                                                        |
| **Platform**                | Role-based access control with custom roles, every tunable in a settings registry (no hard-coded thresholds), currency / country / tax / cost-centre / payment-method masters, exchange rates from a configurable provider, notification preferences per user, data export + deletion, dark mode, English + Korean |
| **Inherited from saaslens** | Payment-to-app matching (CSV / ERP / card feeds), Google Workspace SSO discovery, Chrome extension usage capture, FleetDM devices, seat utilisation, offboarding and shadow-IT detection, AI assistant, super-admin console                                                                                        |

The REST API under `/api/v1` is the contract for the SubHub mobile app (React Native), which is a separate deliverable.

## Tech stack

| Layer    | Technology                                                              |
| -------- | ----------------------------------------------------------------------- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript                           |
| UI       | shadcn/ui + Radix + Tailwind CSS 4, next-themes                         |
| Data     | Prisma 6 / PostgreSQL 14+, TanStack Query, Refine (optional)            |
| Auth     | NextAuth 5 — email + OTP, Google, Apple                                 |
| Email    | Resend                                                                  |
| Storage  | Local disk (dev), Cloudflare R2 or S3                                   |
| Jobs     | Vercel Cron (or any scheduler hitting `/api/cron/*` with `CRON_SECRET`) |

## Quick start

Requirements: Node.js 20+, PostgreSQL 14+ (or Docker).

```bash
git clone <your-subhub-remote>
cd subhub
npm ci --legacy-peer-deps            # React 19 peer-dependency resolution

cp .env.example .env.local           # fill DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL (+ Google/Apple if used)

npx prisma migrate deploy            # creates the schema
npx prisma generate
npm run db:seed                      # currencies, countries, permission catalogue, vendor catalog
npm run db:backfill-defaults         # only when upgrading an existing saaslens database

npm run dev                          # http://localhost:3000
```

Docker alternative: `docker compose up -d` (Postgres + app).

### Environment variables

| Variable                                              | Required                      | Purpose                           |
| ----------------------------------------------------- | ----------------------------- | --------------------------------- |
| `DATABASE_URL`, `DIRECT_URL`                          | yes                           | PostgreSQL connection             |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL`                     | yes                           | Session signing and canonical URL |
| `GOOGLE_CLIENT_ID/SECRET`                             | for Google sign-in            | OAuth                             |
| `APPLE_CLIENT_ID/SECRET`                              | for Apple sign-in             | OAuth (required for the iOS app)  |
| `RESEND_API_KEY`, `EMAIL_FROM`                        | for email                     | Transactional email               |
| `CRON_SECRET`                                         | for jobs                      | Protects `/api/cron/*`            |
| `STORAGE_PROVIDER`, `S3_*` / `R2_*`                   | for attachments in production | Object storage                    |
| `GMAIL_CLIENT_ID/SECRET`, `MS_GRAPH_CLIENT_ID/SECRET` | for receipt detection         | Mailbox OAuth                     |
| `FCM_SERVER_KEY`                                      | for mobile push               | Firebase Cloud Messaging          |

See `.env.example` for the full list.

## Configuration model

SubHub has **no hard-coded business values**. Every threshold, default, lead time, limit and provider lives in the settings registry (`src/lib/settings/registry.ts`) and is editable under **Settings → Workspace settings** (organisation scope) or **Super admin → Platform settings** (system scope). Resolution order: organisation override → system override → registry default.

Master data:

- Global (seeded): currencies (ISO 4217), countries (ISO 3166 with default VAT), permission catalogue, vendor catalog.
- Per organisation (seeded on creation, admin-editable under **Settings → Masters**): roles, categories / subcategories, payment methods, billing-cycle configuration, tax rates, cost centres, tags, custom fields, notification templates.

Exchange rates are refreshed daily (`/api/cron/exchange-rates`) from the provider chosen in `finance.fxProvider` (Frankfurter / open.er-api / exchangerate.host / Google Finance best-effort / manual).

## Access control

Roles are organisation-scoped. The four system roles (Administrator, Approver, Member, Viewer) are seeded with default grants from `src/lib/rbac/permissions.ts`; administrators can create custom roles with any subset of the 55 permissions under **Settings → Roles**. Every server action and API route enforces permissions server-side (`requirePermission`); the UI mirrors them with `usePermissions()` / `<Can>`.

## Scheduled jobs

| Path                                                           | Default schedule | Purpose                                                |
| -------------------------------------------------------------- | ---------------- | ------------------------------------------------------ |
| `/api/cron/subscription-reminders`                             | daily 06:15      | Renewal reminders by lead time, deferred notifications |
| `/api/cron/trial-alerts`                                       | daily 06:30      | Trial-ending alerts                                    |
| `/api/cron/notice-period-alerts`                               | daily 06:45      | Cancellation-window alerts                             |
| `/api/cron/price-change-scan`                                  | daily 07:00      | Detect charge amount changes                           |
| `/api/cron/approval-reminders`                                 | daily 08:00      | Approver reminders, escalation, expiry                 |
| `/api/cron/receipt-scan`                                       | every 6 h        | Mailbox receipt detection                              |
| `/api/cron/exchange-rates`                                     | daily 02:00      | Refresh FX rates                                       |
| `/api/cron/weekly-digest`                                      | Monday 07:00     | Weekly digest email                                    |
| `/api/cron/renewal-alerts`, `auto-renewal`, `review-apps-scan` | daily            | Inherited jobs                                         |

## Development

```bash
npm run quality        # lint + type-check + unit tests
npm run test:coverage  # coverage report (80% threshold)
npm run db:studio      # Prisma Studio
```

Contributor conventions live in `docs/SUBHUB-AGENT-GUIDE.md`. The upstream saaslens guides remain under `docs/guide/`.

## Build log — 4 November 2026

- Baseline: saaslens v0.1.0 imported; upstream migration drift repaired (`20261103000000_upstream_schema_sync`).
- Foundation: `20261104000000_subhub_foundation` (taxonomy, approvals, notifications, documents, receipts, FX, saved views, onboarding, privacy) and `20261104010000_subhub_platform_layer` (RBAC, settings, masters).
- Feature areas delivered against `MVP_Feature_Matrix_Subscription_Management.xlsx` — see `../SubHub-Feature-Verification-Matrix.md` for the capability-by-capability status.
- Verification on 4 November 2026 (after the dependency upgrade): `next build` passes (185 routes); `tsc --noEmit` passes (strict); Vitest 3,534 tests — 3,405 pass, 38 skipped, 91 fail, every failure a pre-existing upstream saaslens failure (baseline 124 failing / 2,582 passing), eight upstream suites repaired, no regressions; Playwright smoke suite 50 / 50 against the production server. Full module/feature tracker: `docs/SUBHUB-IMPLEMENTATION-TRACKER.md`.
- Stack and security: Next.js 15.5.29, next-auth 5.0.0-beta.32, zod 4.6.7, Vite 8 / Vitest 4.1 (all critical/high advisories on direct dependencies resolved); secret-scan pre-commit hook; baseline security headers; see `docs/SECURITY-PRACTICES.md`.

## License

MIT. SubHub contains code from saaslens © 2026 Wondermove-Inc (MIT); see `LICENSE`.
