# SubHub — Engineering Guide for Feature Work

SubHub is built on an open-source subscription-management base (Next.js 15 App Router, React 19, Prisma 6 / PostgreSQL,
NextAuth 5, shadcn/ui, next-intl, Vitest). This guide is the contract for anyone
adding a feature. Read it fully before touching code.

## 1. Non-negotiables

1. **No hard-coded tunables.** Every threshold, default, lead time, limit, label set
   or provider choice is read from the settings registry:
   ```ts
   import { getSetting, getSettings } from "@/lib/settings/service";
   const leadDays = await getSetting(
     organizationId,
     "subscriptions.defaultReminderLeadDays"
   );
   ```
   If the value you need is not in `src/lib/settings/registry.ts`, **add a definition
   there** (group, zod schema, default, UI metadata) — never inline a literal.
2. **RBAC on every write and every sensitive read.** Server actions and API routes
   call `requirePermission("<resource>:<action>")` from `@/lib/rbac/service`
   (throws `ForbiddenError`; map it to `{ success:false, error }` in actions, 403 in
   routes via `withApiAuth(handler, { permission })`). Permission keys live in
   `src/lib/rbac/permissions.ts`; add new keys there and grant them in
   `SYSTEM_ROLE_TEMPLATES`. UI gating uses `<Can permission="…">` or `usePermissions()`.
   Do not gate on `role === "ADMIN"` in new code.
3. **Tenant isolation.** Every query filters by `organizationId` from
   `requireOrganization()` / `requirePermission()`. Never trust ids from the client.
4. **Master data, not enums, for user-facing option lists**: payment methods
   (`PaymentMethodOption`), categories (`Category`), tags (`Tag`), tax rates
   (`TaxRate`), cost centres (`CostCenter`), currencies (`Currency`), countries
   (`Country`), billing-cycle configuration (`BillingCycleConfig`). The
   `BillingCycle` / `SubscriptionStatus` enums stay for compatibility; their
   labels/months come from `BillingCycleConfig` and i18n.
5. **Currency.** Store amounts with their own `currency`; convert for totals with the
   FX helper (`@/lib/fx`) into `finance.baseCurrency`. Never assume USD/KRW.
6. **Audit log** every create/update/delete/decision via `prisma.auditLog.create`
   (`action` like `CREATE_APPROVAL_REQUEST`, `entityType`, `entityId`, `changes`).
7. **Tests first.** Co-locate `*.test.ts(x)` next to source. Mock `@/lib/db`,
   `@/lib/auth`, `@/lib/settings/service` and `@/lib/rbac/service` as the existing
   tests do (see `src/actions/subscriptions.test.ts`). Target ≥80% on new files.
   Baseline: 124 pre-existing failures in upstream tests — do not make it worse.
8. **Files ≤ 500 lines, functions ≤ 50 lines.** Split constants/types/sub-components.
9. **i18n.** SubHub is English-only. Each feature owns one namespace file:
   `src/i18n/messages/en/<area>.json` (areas: platform, approvals, taxonomy,
   lifecycle, notifications, receipts, discovery). Keys are merged automatically.
   Never edit the `en.json` base file for new features. Test lookup resolves
   against the merged English bundle (supports ICU plural/select, falls back to the
   key). Write comments and test names in English.
10. **No `console.log`.** Use `logger` from `@/lib/logger`.

## 2. Conventions already in the codebase

- Server actions: `src/actions/<area>/*.ts`, wrapped with `withLogging("name", fn)`,
  return `ActionState<T>` (`{ success, message?, error?, data?, errors? }`).
- Auth helpers: `requireOrganization()`, `requireAuth()`, `getCachedSession()` in
  `@/lib/auth/require-auth`; RBAC in `@/lib/rbac/service`.
- REST: `src/app/api/v1/<resource>/route.ts`, `withApiAuth` + `withLogging`,
  envelope `{ success, data, error?, meta? }`. Mobile clients consume these.
- Cron: `src/app/api/cron/<job>/route.ts` with `withCronAuth(withLogging(...))`,
  schedules in `vercel.json` (already registered: subscription-reminders,
  trial-alerts, notice-period-alerts, price-change-scan, approval-reminders,
  receipt-scan, exchange-rates, renewal-alerts, weekly-digest).
- Pages: `src/app/(dashboard)/<route>/page.tsx` (server) → `*-page-client.tsx`
  (client). `export const metadata` title like `"Approvals"` (template adds
  "| SubHub").
- UI: shadcn primitives in `@/components/ui/*` (do not re-create), common pieces in
  `@/components/common/*` (`PageHeader`, `DataTable`, `FilterBar`, `KpiCard`,
  `Can`). Tailwind 4 tokens; both light and dark themes must look intentional.
- Email: `@/lib/services/notification/email*` (Resend). In-app notifications go
  through the notification service owned by the notifications area
  (`@/lib/services/notification/center`), which respects `NotificationPreference`
  and `notifications.*` settings. Other areas call `notify(...)` from it; if it is
  not present yet, write a thin local stub with the same signature and leave a
  `// TODO(notifications)` marker.
- Validation: zod at every boundary (`src/lib/validations/*`).
- Database: schema already contains every model listed below. If you need a
  column that is missing, add it to `prisma/schema.prisma`, run
  `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<ts>_<name>/migration.sql`,
  then `npx prisma migrate deploy && npx prisma generate`, and say so in your report.

## 3. Shared foundation (already built)

| Concern                      | Where                                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings registry + service  | `src/lib/settings/registry.ts`, `src/lib/settings/service.ts`                                                                                                                                                 |
| Permissions catalogue + RBAC | `src/lib/rbac/permissions.ts`, `src/lib/rbac/service.ts`, `/api/v1/me/permissions`, `usePermissions`, `<Can>`                                                                                                 |
| Org default masters          | `src/lib/masters/organization-defaults.ts` (roles, categories, payment methods, billing cycles, tax rate)                                                                                                     |
| Global masters seed          | `prisma/seed.ts` (currencies, countries, permissions)                                                                                                                                                         |
| Nav entries                  | main sidebar: `/subscriptions/pipeline`, `/approvals`, `/notifications`; settings sidebar: `/settings/approvals`, `/settings/taxonomy`, `/settings/custom-fields`, `/settings/mailboxes`, `/settings/privacy` |
| i18n namespaces              | `src/i18n/messages/{en,ko}/<area>.json`                                                                                                                                                                       |

## 4. Local environment

```bash
# Postgres (docker): postgresql://subhub:subhub@localhost:54329/subhub  (.env.local)
npx prisma migrate deploy && npx prisma generate && npm run db:seed
NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit      # type-check
npx vitest run <path>                                         # targeted tests
npx eslint <paths>
```

## 5. Definition of done for a feature area

- Schema used as designed; migrations added only if needed.
- Server actions + REST endpoints + pages + components + i18n + tests.
- `tsc --noEmit` clean, eslint clean on touched files, new tests green.
- Short report: files added, settings keys added, permission keys added, anything
  left as TODO.
