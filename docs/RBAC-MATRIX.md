# SubHub — Roles & Permissions Matrix

Prepared by HelloPixels for the SubHub RBAC review (6 Nov 2026). Source of truth:
`src/lib/rbac/permissions.ts` (catalogue, system role templates, `PERMISSION_ROLLOUTS`)
and `src/lib/rbac/service.ts` (resolver and guards). The regression test
`src/lib/rbac/role-templates.test.ts` fails if a template drifts from this matrix;
`tests/e2e/rbac.spec.ts` checks the running application per role.

## 1. How access is decided

| Step               | Rule                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resolver           | `getUserPermissionSet(user, org)`: SUPER_ADMIN → everything; a user with a **custom role** (`roleId`) → that role's grants; otherwise the organisation's **system role** matching the legacy `role` enum (ADMIN, APPROVER, MEMBER, VIEWER). SaaS mode strips platform-only keys (`masters:manage_global`, `catalog:manage`). A deactivated organisation resolves to nothing. |
| Pages              | `requirePermissionOrRedirect(key, fallback)` at the top of each server page (or the area layout). Missing permission → redirect to the fallback route.                                                                                                                                                                                                                       |
| Server actions     | `requirePermission(key)` / `can(key)` before any read of sensitive data or any write. Denials return `{ success: false, … }` or throw `ForbiddenError`.                                                                                                                                                                                                                      |
| `/api/v1` (mobile) | `withApiAuth(handler, { permission })` or an explicit `can()` → HTTP 403 `{ success: false, error: "Forbidden: missing permission" }`.                                                                                                                                                                                                                                       |
| UI                 | Sidebar, settings sidebar, quick-create menu and command palette list only entries the user's permission set allows (`/api/v1/me/permissions`, `usePermissions`, `useSafePermissions`, `<Can>`); refine `useCan` is backed by the same set. Gating in the UI is presentation only — the server re-checks.                                                                    |
| Data scope         | `subscriptions:read_all` widens subscription lists, dashboards and cost/renewal/usage reports from own team (or self) to the whole organisation; `audit:read_all` widens the audit log from own entries to everyone; `subscriptions:assign` is needed to assign seats to other members.                                                                                      |

The legacy `role` enum is no longer used for any access decision. It only selects the
system role when no custom role is assigned, and it still marks the _target_ of
"cannot offboard / demote the last administrator" safeguards.

## 2. Role × permission grid

"Finance analyst (custom)" is a sample custom role an administrator can create at
`/settings/roles`: read-only subscriptions across the organisation plus payments and
reports with export.

| Permission                       | Description                                                    | Admin | Approver | Member | Viewer | Finance analyst (custom) |
| -------------------------------- | -------------------------------------------------------------- | :---: | :------: | :----: | :----: | :----------------------: |
| **Subscriptions**                |                                                                |       |          |        |        |                          |
| `subscriptions:read`             | View subscriptions                                             |   ✓   |    ✓     |   ✓    |   ✓    |            ✓             |
| `subscriptions:create`           | Add subscriptions                                              |   ✓   |    ✓     |   ✓    |   –    |            –             |
| `subscriptions:update`           | Edit, pause, archive subscriptions                             |   ✓   |    ✓     |   ✓    |   –    |            –             |
| `subscriptions:delete`           | Delete subscriptions                                           |   ✓   |    –     |   –    |   –    |            –             |
| `apps:read`                      | View the organisation's apps                                   |   ✓   |    ✓     |   ✓    |   ✓    |            –             |
| `apps:manage`                    | Create, edit and delete apps (vendors)                         |   ✓   |    –     |   –    |   –    |            –             |
| `subscriptions:bulk`             | Bulk edit subscriptions                                        |   ✓   |    –     |   –    |   –    |            –             |
| `subscriptions:export`           | Export subscription data                                       |   ✓   |    ✓     |   ✓    |   –    |            –             |
| `subscriptions:read_all`         | See every subscription, not only own/team                      |   ✓   |    ✓     |   –    |   –    |            ✓             |
| `subscriptions:assign`           | Assign subscription seats to other members                     |   ✓   |    –     |   –    |   –    |            –             |
| **Approvals**                    |                                                                |       |          |        |        |                          |
| `approvals:read`                 | View own approval requests                                     |   ✓   |    ✓     |   ✓    |   ✓    |            ✓             |
| `approvals:read_all`             | View all approval requests                                     |   ✓   |    ✓     |   –    |   –    |            ✓             |
| `approvals:create`               | Submit approval requests                                       |   ✓   |    ✓     |   ✓    |   –    |            –             |
| `approvals:decide`               | Approve, reject or request information                         |   ✓   |    ✓     |   –    |   –    |            –             |
| `approvals:cancel_any`           | Cancel any pending request                                     |   ✓   |    –     |   –    |   –    |            –             |
| `approvals:export`               | Export approval history                                        |   ✓   |    ✓     |   –    |   –    |            –             |
| `approval_policies:read`         | View approval policies                                         |   ✓   |    ✓     |   ✓    |   ✓    |            –             |
| `approval_policies:manage`       | Create and edit approval policies                              |   ✓   |    –     |   –    |   –    |            –             |
| **Taxonomy**                     |                                                                |       |          |        |        |                          |
| `categories:read`                | View categories                                                |   ✓   |    ✓     |   ✓    |   ✓    |            –             |
| `categories:manage`              | Create, rename, archive categories                             |   ✓   |    –     |   –    |   –    |            –             |
| `tags:read`                      | View tags                                                      |   ✓   |    ✓     |   ✓    |   ✓    |            –             |
| `tags:create`                    | Create tags while editing                                      |   ✓   |    ✓     |   ✓    |   –    |            –             |
| `tags:manage`                    | Rename, merge and delete tags                                  |   ✓   |    –     |   –    |   –    |            –             |
| `custom_fields:read`             | View custom fields                                             |   ✓   |    ✓     |   ✓    |   ✓    |            –             |
| `custom_fields:manage`           | Define custom fields                                           |   ✓   |    –     |   –    |   –    |            –             |
| **Masters**                      |                                                                |       |          |        |        |                          |
| `masters:read`                   | View currencies, tax rates, cost centres, payment methods      |   ✓   |    ✓     |   ✓    |   ✓    |            –             |
| `masters:manage`                 | Edit master data                                               |   ✓   |    –     |   –    |   –    |            –             |
| `masters:manage_global`          | Create and edit platform-wide masters: currencies, countries   |   ✓   |    –     |   –    |   –    |            –             |
| `catalog:read`                   | View the App catalog                                           |   ✓   |    ✓     |   ✓    |   ✓    |            –             |
| `catalog:manage`                 | Edit App catalog entries and cancellation guides               |   ✓   |    –     |   –    |   –    |            –             |
| **Documents**                    |                                                                |       |          |        |        |                          |
| `attachments:read`               | View and download attachments                                  |   ✓   |    ✓     |   ✓    |   ✓    |            –             |
| `attachments:upload`             | Upload attachments                                             |   ✓   |    ✓     |   ✓    |   –    |            –             |
| `attachments:delete`             | Delete attachments                                             |   ✓   |    –     |   –    |   –    |            –             |
| `comments:create`                | Add notes and comments                                         |   ✓   |    ✓     |   ✓    |   –    |            –             |
| **Notifications**                |                                                                |       |          |        |        |                          |
| `notifications:read`             | View notification centre                                       |   ✓   |    ✓     |   ✓    |   ✓    |            ✓             |
| `notifications:manage_own`       | Change own notification preferences                            |   ✓   |    ✓     |   ✓    |   ✓    |            ✓             |
| `notifications:manage_templates` | Edit notification templates                                    |   ✓   |    –     |   –    |   –    |            –             |
| **Members**                      |                                                                |       |          |        |        |                          |
| `members:read`                   | View members                                                   |   ✓   |    ✓     |   ✓    |   ✓    |            –             |
| `members:invite`                 | Invite members                                                 |   ✓   |    –     |   –    |   –    |            –             |
| `members:manage`                 | Change roles, deactivate members                               |   ✓   |    –     |   –    |   –    |            –             |
| `members:manage_credentials`     | Set member user names and temporary passwords, unlock accounts |   ✓   |    –     |   –    |   –    |            –             |
| `teams:read`                     | View teams                                                     |   ✓   |    ✓     |   ✓    |   ✓    |            –             |
| `teams:manage`                   | Create and edit teams, assign approvers                        |   ✓   |    –     |   –    |   –    |            –             |
| `roles:manage`                   | Create custom roles and grant permissions                      |   ✓   |    –     |   –    |   –    |            –             |
| **Finance**                      |                                                                |       |          |        |        |                          |
| `payments:read`                  | View payment records and cards                                 |   ✓   |    ✓     |   –    |   –    |            ✓             |
| `payments:manage`                | Import, match and edit payments                                |   ✓   |    –     |   –    |   –    |            ✓             |
| `budgets:manage`                 | Set budgets and thresholds                                     |   ✓   |    –     |   –    |   –    |            –             |
| **Insights**                     |                                                                |       |          |        |        |                          |
| `reports:read`                   | View dashboards and reports                                    |   ✓   |    ✓     |   ✓    |   ✓    |            ✓             |
| `reports:export`                 | Export reports                                                 |   ✓   |    ✓     |   –    |   –    |            ✓             |
| `audit:read`                     | View own audit trail                                           |   ✓   |    ✓     |   ✓    |   –    |            ✓             |
| `audit:read_all`                 | View every member's audit trail                                |   ✓   |    ✓     |   –    |   –    |            ✓             |
| `audit:export`                   | Export audit log                                               |   ✓   |    –     |   –    |   –    |            –             |
| **Integrations**                 |                                                                |       |          |        |        |                          |
| `integrations:read`              | View integrations                                              |   ✓   |    ✓     |   ✓    |   ✓    |            –             |
| `integrations:manage`            | Connect and sync integrations                                  |   ✓   |    –     |   –    |   –    |            –             |
| `mailboxes:connect_own`          | Connect own mailbox for receipt detection                      |   ✓   |    ✓     |   ✓    |   –    |            –             |
| `mailboxes:manage`               | Manage all mailbox connections                                 |   ✓   |    –     |   –    |   –    |            –             |
| **Extensions**                   |                                                                |       |          |        |        |                          |
| `extensions:read`                | View browser-extension usage, devices and block lists          |   ✓   |    –     |   –    |   –    |            –             |
| `extensions:manage`              | Manage extension builds, tokens, block lists and device apps   |   ✓   |    –     |   –    |   –    |            –             |
| **Settings**                     |                                                                |       |          |        |        |                          |
| `settings:read`                  | View organisation settings                                     |   ✓   |    ✓     |   ✓    |   ✓    |            –             |
| `settings:manage`                | Change organisation settings                                   |   ✓   |    –     |   –    |   –    |            –             |
| `organization:manage`            | Edit organisation profile and domains                          |   ✓   |    –     |   –    |   –    |            –             |
| **Privacy**                      |                                                                |       |          |        |        |                          |
| `data:export_own`                | Export own data                                                |   ✓   |    ✓     |   ✓    |   ✓    |            ✓             |
| `data:delete_own`                | Delete own account                                             |   ✓   |    ✓     |   ✓    |   ✓    |            –             |
| `data:export_org`                | Export organisation data                                       |   ✓   |    –     |   –    |   –    |            –             |

## 3. What each role can do

| Capability                                                            |       Admin       |       Approver       |              Member              |        Viewer        |
| --------------------------------------------------------------------- | :---------------: | :------------------: | :------------------------------: | :------------------: |
| See subscriptions                                                     |        All        |         All          |             Own team             |   Assigned to them   |
| Add / edit subscriptions                                              |         ✓         |          ✓           |                ✓                 |          –           |
| Delete subscriptions, bulk edit                                       |         ✓         |          –           |                –                 |          –           |
| Assign seats to other members                                         |         ✓         |          –           |                –                 |          –           |
| Submit approval requests                                              |         ✓         |          ✓           |                ✓                 |          –           |
| Decide approvals (approve / reject / request info)                    |         ✓         |          ✓           |                –                 |          –           |
| See every approval request                                            |         ✓         |          ✓           | Own + where they are an approver |         Own          |
| Edit approval policies                                                |         ✓         |          –           |                –                 |          –           |
| Reports (cost / renewal / usage)                                      | Org-wide + export |  Org-wide + export   |             Own team             | Own scope, no export |
| Audit log                                                             | Everyone + export |       Everyone       |           Own entries            |          –           |
| Payments, cards, payment records                                      |      Manage       |         Read         |                –                 |          –           |
| Browser extension, devices, block lists                               |      Manage       |          –           |                –                 |          –           |
| Integrations                                                          |      Manage       |         Read         |               Read               |         Read         |
| Members & teams                                                       |  Manage, invite   |         Read         |               Read               |         Read         |
| Roles & permissions                                                   |         ✓         |          –           |                –                 |          –           |
| Workspace settings, organisation profile                              |      Manage       |         Read         |               Read               |         Read         |
| Master data (currencies, tax, categories, tags, custom fields)        |      Manage       | Read (+ create tags) |       Read (+ create tags)       |         Read         |
| Own profile, appearance, own notification preferences, privacy export |         ✓         |          ✓           |                ✓                 |          ✓           |

## 4. Pages

| Route                                                                                      | Guard                                                                                 | Admin | Approver | Member | Viewer |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | :---: | :------: | :----: | :----: |
| `/dashboard`                                                                               | `reports:read` (scope by `subscriptions:read_all`)                                    |   ✓   |    ✓     | ✓ team |   ✓    |
| `/subscriptions`, `/pipeline`, `/calendar`, `/subscriptions/[id]`                          | `subscriptions:read`                                                                  |   ✓   |    ✓     |   ✓    |   ✓    |
| `/subscriptions/new`                                                                       | `subscriptions:create`                                                                |   ✓   |    ✓     |   ✓    |   –    |
| `/subscriptions/[id]/edit`                                                                 | `subscriptions:update`                                                                |   ✓   |    ✓     |   ✓    |   –    |
| `/subscriptions/suggestions`                                                               | `subscriptions:create` + `subscriptions:assign`                                       |   ✓   |    –     |   –    |   –    |
| `/subscriptions/receipts`                                                                  | receipts scope (`mailboxes:*`)                                                        |   ✓   |    ✓     |   ✓    |   –    |
| `/apps`, `/apps/[id]`                                                                      | `apps:read`                                                                           |   ✓   |    ✓     |   ✓    |   ✓    |
| `/apps/new` (redirects to `/apps` with the Create app dialog), `/apps/[id]/edit`           | `apps:manage`                                                                         |   ✓   |    –     |   –    |   –    |
| `/approvals`, `/approvals/[id]`                                                            | `approvals:read`                                                                      |   ✓   |    ✓     |   ✓    |   ✓    |
| `/approvals/new`                                                                           | `approvals:create`                                                                    |   ✓   |    ✓     |   ✓    |   –    |
| `/notifications`                                                                           | `notifications:read`                                                                  |   ✓   |    ✓     |   ✓    |   ✓    |
| `/reports/*` (layout), cost / renewal / usage                                              | `reports:read`; export button `reports:export`                                        |   ✓   |    ✓     |   ✓    |   ✓    |
| `/reports/audit`                                                                           | `audit:read`; export `audit:export`                                                   |   ✓   |    ✓     | ✓ own  |   –    |
| `/reports/block-events`, `browsing-usage`, `registered-app-usage`                          | `reports:read` + `extensions:read`                                                    |   ✓   |    –     |   –    |   –    |
| `/payments/*` (layout), `/payments`, `/payments/cards`                                     | `payments:read`; card actions `payments:manage`                                       |   ✓   |    ✓     |   –    |   –    |
| `/payments/cards/[id]`                                                                     | `payments:manage`                                                                     |   ✓   |    –     |   –    |   –    |
| `/extensions/*` (layout + pages), `/devices`, `/settings/devices`                          | `extensions:read`; actions `extensions:manage`                                        |   ✓   |    –     |   –    |   –    |
| `/extension-guide`                                                                         | signed in (installation guide for every employee)                                     |   ✓   |    ✓     |   ✓    |   ✓    |
| `/teams`                                                                                   | `teams:read`; add / edit / delete `teams:manage`                                      |   ✓   |    ✓     |   ✓    |   ✓    |
| `/users`, `/users/[id]`, `/users/offboarded`                                               | `members:read`; invite / offboard `members:invite` / `members:manage`                 |   ✓   |    ✓     |   ✓    |   ✓    |
| `/org/sync`                                                                                | `teams:manage` + `members:manage`                                                     |   ✓   |    –     |   –    |   –    |
| `/integrations`, `/integrations/[id]`                                                      | `integrations:read`; actions `integrations:manage`                                    |   ✓   |    ✓     |   ✓    |   ✓    |
| `/integrations/new`, `/integrations/[id]/edit`                                             | `integrations:manage`                                                                 |   ✓   |    –     |   –    |   –    |
| `/kanban`, `/tasks` (V2)                                                                   | `subscriptions:read`; manage `subscriptions:update`                                   |   ✓   |    ✓     |   ✓    |   ✓    |
| `/settings/profile`, `/settings/appearance`, `/settings/privacy`                           | signed in (self-service)                                                              |   ✓   |    ✓     |   ✓    |   ✓    |
| `/settings/notifications`                                                                  | `notifications:manage_own`                                                            |   ✓   |    ✓     |   ✓    |   ✓    |
| `/settings/organization`                                                                   | `organization:manage`                                                                 |   ✓   |    –     |   –    |   –    |
| `/settings/team`                                                                           | `members:invite` or `members:manage`                                                  |   ✓   |    –     |   –    |   –    |
| `/settings/workspace/[group]`                                                              | `settings:read` (edit `settings:manage`)                                              |   ✓   |   read   |  read  |  read  |
| `/settings/masters`                                                                        | any masters / taxonomy read                                                           |   ✓   |    ✓     |   ✓    |   ✓    |
| `/settings/roles`                                                                          | `roles:manage`                                                                        |   ✓   |    –     |   –    |   –    |
| `/settings/notification-templates`                                                         | `notifications:manage_templates`                                                      |   ✓   |    –     |   –    |   –    |
| `/settings/approvals`                                                                      | `approval_policies:read` (edit `manage`)                                              |   ✓   |   read   |  read  |  read  |
| `/settings/mailboxes`                                                                      | `mailboxes:connect_own` or `mailboxes:manage`                                         |   ✓   |    ✓     |   ✓    |   –    |
| `/settings/import`                                                                         | `apps:manage`, `subscriptions:bulk` or `members:manage` (each import type re-checked) |   ✓   |    –     |   –    |   –    |
| `/settings/saas-review`                                                                    | `apps:manage`                                                                         |   ✓   |    –     |   –    |   –    |
| `/settings/budget`, `/settings/taxonomy`, `/settings/custom-fields`, `/settings/workspace` | redirect-only to the guarded pages above                                              |       |          |        |        |

## 5. Server actions (writes)

| Area                                                                                                                                                                                     | Permission                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subscriptions create / update / delete / bulk / export                                                                                                                                   | `subscriptions:create` / `update` / `delete` / `bulk` / `export`; seat assignment `subscriptions:assign`; suggestions → subscription `subscriptions:create` (+ `assign` with users) |
| Approvals (owned by the approvals area)                                                                                                                                                  | `approvals:create`, `approvals:decide`, `approvals:cancel_any`, `approval_policies:manage`                                                                                          |
| Apps (service layer, also used by the AI write tool)                                                                                                                                     | `apps:manage`                                                                                                                                                                       |
| Bulk import: apps / subscriptions / users                                                                                                                                                | `apps:manage` / `subscriptions:bulk` / `members:manage`                                                                                                                             |
| Members: role change, remove, offboard, delete, update, revoke access                                                                                                                    | `members:manage`; transfer admin `roles:manage`; invitations `members:invite`                                                                                                       |
| Teams: create / update / delete / assign; org CSV sync                                                                                                                                   | `teams:manage`; org sync `teams:manage` + `members:manage`                                                                                                                          |
| Organisation profile, teams list, domains                                                                                                                                                | `organization:manage`                                                                                                                                                               |
| Organisation notification settings, renewal-alert generate / delete                                                                                                                      | `settings:manage`                                                                                                                                                                   |
| Renewal alert create / mark sent                                                                                                                                                         | `subscriptions:update`                                                                                                                                                              |
| Report schedules                                                                                                                                                                         | `reports:export`                                                                                                                                                                    |
| Payments: import, matching, records, merchant patterns, mapping profiles, rematch, pending SaaS confirmations, cards (register / delete / team / sync / manual match)                    | `payments:manage` (reads `payments:read`)                                                                                                                                           |
| Integrations: create / update / delete / sync                                                                                                                                            | `integrations:manage` (reads `integrations:read`)                                                                                                                                   |
| Extensions & devices: block / allow lists, registered / recommended / review apps, builds, deploy settings, device status, extension credentials, inactive threshold, shadow-IT approval | `extensions:manage` (reads `extensions:read`); credentials are also locked to the caller's own organisation                                                                         |
| SaaS review (pending apps, inference e-mail)                                                                                                                                             | `apps:manage`                                                                                                                                                                       |
| OS default apps (platform-wide list)                                                                                                                                                     | `catalog:manage` (single-tenant only)                                                                                                                                               |
| Audit log                                                                                                                                                                                | read `audit:read` (own) / `audit:read_all`; export `audit:export`                                                                                                                   |
| Roles & permissions                                                                                                                                                                      | `roles:manage`                                                                                                                                                                      |
| Masters, taxonomy, catalog, notification templates, workspace settings, privacy                                                                                                          | as in the grid (`masters:*`, `categories:*`, `tags:*`, `custom_fields:*`, `catalog:*`, `notifications:manage_templates`, `settings:manage`, `data:*`)                               |
| Self-service (profile, password, own notification preferences, own account deletion)                                                                                                     | signed in                                                                                                                                                                           |

## 6. `/api/v1` endpoints

| Endpoint                                                                                | Permission                                             | 403 for                        |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------ |
| `GET /me/permissions`, `GET /me/context`                                                | signed in                                              | –                              |
| `GET /subscriptions`                                                                    | `subscriptions:read` (scoped list)                     | –                              |
| `POST /subscriptions`                                                                   | `subscriptions:create`                                 | Viewer                         |
| `/subscriptions/[id]/status`, `attachments`, `comments`                                 | delegated to the guarded actions                       | per action                     |
| `GET /approvals`, `/approvals/[id]`                                                     | `approvals:read`                                       | –                              |
| `POST /approvals`                                                                       | `approvals:create`                                     | Viewer                         |
| `POST /approvals/bulk-decision`, `GET /approvals/decision-options`                      | `approvals:decide`                                     | Member, Viewer                 |
| `GET /integrations` / `POST /integrations`                                              | `integrations:read` / `integrations:manage`            | POST: Approver, Member, Viewer |
| `PUT, DELETE /integrations/[id]`, `POST /integrations/[id]/sync`                        | `integrations:manage`                                  | Approver, Member, Viewer       |
| `POST /payments/import-stream`, `POST /payments/rematch`, `POST /cards/[id]/retry-sync` | `payments:manage`                                      | Approver, Member, Viewer       |
| `GET /sync-history`                                                                     | `payments:read`                                        | Member, Viewer                 |
| `GET /terminated-users`                                                                 | `members:read`                                         | –                              |
| `GET /extensions/reports/*`, `POST /extensions/builds/execute` (session)                | `extensions:read` / `extensions:manage`                | Approver, Member, Viewer       |
| Other `/extensions/*` sync endpoints                                                    | extension API token (device credential), not user RBAC | –                              |
| Masters, taxonomy, saved views, search, dashboard overview, notifications, roles        | catalogue read keys (see route `permission` option)    | –                              |

## 7. Template changes in this review

| Change                                                  | Why                                                                | Rollout                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| New `subscriptions:assign` (Admin)                      | Replaces the `role === "ADMIN"` seat-assignment checks             | `PERMISSION_ROLLOUTS`                                                          |
| New `audit:read_all` (Admin, Approver)                  | Replaces `role === "MEMBER"` / `"ADMIN"` audit scoping             | `PERMISSION_ROLLOUTS`                                                          |
| New `extensions:read`, `extensions:manage` (Admin)      | Extension / device monitoring had no permission at all             | `PERMISSION_ROLLOUTS`                                                          |
| `payments:read` removed from Member (kept for Approver) | Organisation finance data; the member sidebar already hid Payments | `PERMISSION_ROLLOUTS` (now a two-way sync: grants and revokes on system roles) |

`npm run db:backfill-defaults` re-syncs the listed keys on every organisation's system
roles. Custom roles are never changed; administrators grant the new keys to custom roles
at `/settings/roles` as needed.
