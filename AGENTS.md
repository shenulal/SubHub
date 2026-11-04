# SubHub — Repository Guidelines

SubHub is HelloPixels' subscription-management product, derived from saaslens. The full
engineering contract (settings registry, RBAC, i18n namespaces, testing, file limits,
ownership conventions) is in **`docs/SUBHUB-AGENT-GUIDE.md`** — read it before any change.

## Essentials

- Language: TypeScript, React 19, Next.js 15 App Router. English is the default locale;
  Korean is supported (new keys may mirror English).
- No hard-coded tunables: read everything through `@/lib/settings/service`
  (`src/lib/settings/registry.ts` is the catalogue).
- RBAC on every write and sensitive read: `requirePermission("<resource>:<action>")`
  (`src/lib/rbac/permissions.ts`); UI gating with `<Can>` / `usePermissions()`.
- Tenant isolation: filter every query by `organizationId`.
- Master data over enums: categories, tags, custom fields, payment methods, tax rates,
  cost centres, currencies, countries, billing-cycle configuration.
- Money: store amount + currency; convert for totals with `@/lib/fx` into the
  organisation base currency.
- Audit log on every create / update / delete / decision.
- Tests first (Vitest, co-located, ≥80% on new code). Files ≤500 lines, functions ≤50.
- Commits: conventional (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).

## Commands

- `npm run dev` · `npm run build` · `npm run quality` (lint + type-check + tests)
- `npx prisma migrate deploy && npx prisma generate` · `npm run db:seed`
- Type-check needs a larger heap: `NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit`

## Structure

```
src/app/(auth)         login, signup, invite, onboarding
src/app/(dashboard)    dashboard, subscriptions (list/pipeline/calendar/receipts), approvals,
                       notifications, reports, payments, users, teams, integrations, settings
src/app/api/v1         REST API (mobile contract)      src/app/api/cron   scheduled jobs
src/actions            server actions by area          src/lib/services   domain services
src/lib/settings       settings registry + service     src/lib/rbac       permissions + service
src/lib/fx             currency conversion             src/lib/masters    org default masters
src/components         UI by area (+ ui/ primitives)   src/i18n/messages  en/, ko/ namespaces
prisma                 schema, migrations, seeds
```
