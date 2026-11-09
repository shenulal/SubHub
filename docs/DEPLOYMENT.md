# SubHub — Deployment Guide

SubHub runs in one of two **deployment modes**, chosen by a single environment variable.
Everything that depends on tenancy (organisation creation, sign-up, super-admin console,
platform-wide permissions, webhook and job fallbacks) follows it.

| `SUBHUB_DEPLOYMENT_MODE`                                           | Meaning                                                                                                                              |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `single-tenant` (**default**; aliases `on-premise`, `self-hosted`) | One organisation per installation — the customer hosts SubHub on its own infrastructure.                                             |
| `saas`                                                             | Multi-tenant cloud operated by HelloPixels — many organisations, isolated by `organizationId`, managed from the super-admin console. |

An unknown value stops the server at start-up with a clear error (`src/instrumentation.ts`).
The active mode is shown read-only in **Settings → overview** and in the **super-admin console**
sidebar, and is published to clients at `GET /api/v1/system/info`.

## 1. What changes between the modes

| Area                            | single-tenant (on-premise)                                                                                                                                                     | saas                                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organisations                   | Exactly one. The first user to finish onboarding creates it and becomes ADMIN (first-run setup). Creating another is refused server-side (onboarding and super-admin console). | Many. With `system.allowSelfSignup` a new customer creates their own organisation through onboarding; the platform operator can also create tenants in the console. |
| Joining                         | By invitation, or automatically into the organisation when the email domain is one of its domains and `system.allowSelfSignup` is on.                                          | By invitation, or by email domain only into the organisation that claimed that domain as its primary domain (and only while self-signup is on).                     |
| Public sign-up form             | Open during first-run setup; afterwards follows `system.allowSelfSignup` (off by default, so the sign-in page shows no sign-up link).                                          | Follows `system.allowSelfSignup` (off by default: tenants are created in the Control Panel).                                                                        |
| Platform-wide permissions       | `masters:manage_global` and `catalog:manage` stay with the organisation ADMIN (it is their installation).                                                                      | Platform-only: stripped from every tenant role (system and custom) by the permission resolver and hidden in the role editor. Only SUPER_ADMIN holds them.           |
| Shared exchange-rate table      | Manual rates / provider refresh need `masters:manage`.                                                                                                                         | Additionally need `masters:manage_global` (platform-only); the daily `exchange-rates` job keeps rates current.                                                      |
| OS default apps, catalog verify | Organisation ADMIN maintains the shared lists.                                                                                                                                 | Tenants cannot change shared lists; approving an app does not mark the shared catalog entry verified.                                                               |
| Sign-in page SSO rule           | The installation's organisation setting `security.enforceSso`.                                                                                                                 | The platform (system) value — never "the first organisation".                                                                                                       |
| FleetDM webhook without team    | Falls back to the only active FleetDM integration.                                                                                                                             | Never guesses: the integration must store `credentials.teamId`; otherwise the event is logged and skipped.                                                          |
| Super-admin console             | Shows the single organisation (create only while none exists), administrators, extension builds, platform masters, platform settings.                                          | Tenant list, create, view/edit, deactivate/reactivate; a tenant selector on overview, administrators and extension builds; platform masters; platform settings.     |

Platform-wide changes made by a SUPER_ADMIN (tenants, currencies, countries, App catalog)
are recorded in `platform_audit_logs`; changes made inside an organisation stay in its `audit_logs`.

## 2. On-premise / self-hosted install (single tenant)

### 2.1 Requirements

- Docker Engine 24+ with the Compose plugin (or Podman with `podman compose`).
- 2 vCPU / 4 GB RAM minimum for the app and Postgres; build the image on a machine with 8 GB.
- A DNS name and a TLS-terminating reverse proxy (nginx, Traefik, Caddy, or a load balancer).
- Optional: an email provider through Resend (`RESEND_API_KEY`) for password-reset links, the optional
  emailed sign-in code and notifications. Sign-in itself is user name / email + password and works
  without email.

### 2.2 Configure

```bash
cp .env.example .env
```

Set at least:

| Variable                                             | Value                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `SUBHUB_DEPLOYMENT_MODE`                             | `single-tenant` (default; may be omitted)                                                               |
| `POSTGRES_PASSWORD`                                  | Long random password for the bundled Postgres (`openssl rand -base64 24`)                               |
| `AUTH_SECRET`                                        | `openssl rand -base64 32` — the server refuses to start in production without it (or `NEXTAUTH_SECRET`) |
| `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`                | The public `https://` URL users open                                                                    |
| `CRON_SECRET`                                        | `openssl rand -base64 32` — used by the `scheduler` service                                             |
| `ENCRYPTION_KEY`                                     | 32 random characters — encrypts mailbox and card credentials at rest                                    |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`    | Email delivery (optional; without it reset links and codes cannot be emailed)                           |
| `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET` (optional) | Sign in with Apple; off unless both are set. Google sign-in is not offered.                             |
| `STORAGE_PROVIDER`                                   | `local` (default, stored in the `app_storage` volume) or `s3` / `r2` with the `S3_*` values             |

`DATABASE_URL` and `DIRECT_URL` are generated by `docker-compose.yml` from the `POSTGRES_*`
values. To use an existing PostgreSQL server instead, remove the `postgres` service, set both
URLs in `.env`, and delete the `DATABASE_URL`/`DIRECT_URL` lines from `x-app-environment`.

> **Never set `AUTH_DEV_OTP` on a customer or production installation.** It is a fixed
> sign-in code for local development. It is ignored on a non-localhost `NEXTAUTH_URL`, but an
> installation reached through `http://localhost` (for example an SSH tunnel) would accept it.

### 2.3 Start

```bash
docker compose up -d --build
docker compose logs -f migrate app
```

`docker-compose.yml` runs four services:

| Service     | Image target | Role                                                                                                                                                                                               |
| ----------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `postgres`  | postgres:15  | Database; data in the `postgres_data` volume; not published on the host.                                                                                                                           |
| `migrate`   | `migrator`   | Runs `scripts/docker-migrate.sh` on every `up`: `prisma migrate deploy`, seeds the platform masters on first install (empty currency table), then `npm run db:backfill-defaults`. Exits when done. |
| `app`       | `runner`     | The Next.js server on port 3000 (bound to `127.0.0.1:${SUBHUB_PORT:-3000}`), started only after `migrate` succeeds. Health check: `GET /api/v1/system/info`.                                       |
| `scheduler` | `runner`     | busybox `crond` calling the `/api/cron/*` jobs with `CRON_SECRET` on the schedule in `deploy/scheduler/crontab.template` (UTC, mirrors `vercel.json`).                                             |

Point the reverse proxy at `http://127.0.0.1:3000` and serve it over HTTPS (HSTS is sent by the app
in production).

### 2.4 First-run setup

1. Open the public URL and choose **Sign up** (the form is open while no organisation exists,
   even if `system.allowSelfSignup` is off). Enter name, email, an optional user name and the
   **first administrator password** (default policy: ≥ 10 characters with upper/lower case, a
   number and a symbol). Store it in the customer's vault.
2. You are signed in straight away; complete onboarding. That user creates **the** organisation
   and becomes its ADMIN. Onboarding then stops offering "create organisation" to anyone.
3. Review **Settings → Security**: password policy, lockout (attempts / minutes), the optional
   emailed second step (`security.requireLoginOtp`, needs email) and passwordless email-code
   sign-in (`security.allowEmailCodeSignIn`, off by default).
4. Add colleagues from **Users → Invite** (they set their password on the invitation page). Sites
   without email: open a member and use **Set password** to give a temporary password; the member
   must change it at first sign-in. The same dialog unlocks a locked account. Optionally add the
   company domains in **Settings → Organisation**; with self-signup on, people with those email
   domains join automatically as members.
5. Lost administrator password without email: another user holding `members:manage_credentials`
   can set a temporary one; otherwise use the database recovery in `docs/SECURITY-PRACTICES.md`.
6. Optional platform operator account for the Control Panel (`/super-admin/login`, section 4):
   set `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in `.env` before the first start (the `migrate`
   job creates it), or run `docker compose run --rm migrate npm run platform:create-super-admin`.

### 2.5 Backups

- Database (daily, keep ≥ 14 days, copy off the host):
  `docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > subhub-$(date +%F).dump`
- Restore into an empty database:
  `docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < subhub-YYYY-MM-DD.dump`
- Files: back up the `app_storage` volume when `STORAGE_PROVIDER=local` (attachments and data
  exports), e.g. `docker run --rm -v subhub_app_storage:/data -v "$PWD":/backup alpine tar czf /backup/storage-$(date +%F).tgz -C /data .`
- Keep `.env` (secrets) in the customer's secret vault. Losing `ENCRYPTION_KEY` means mailbox and
  card connections must be re-authorised.
- Test a restore at least once per quarter.

### 2.6 Upgrades

```bash
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > pre-upgrade.dump
git pull                                  # or unpack the new release
docker compose build
docker compose up -d                      # migrate runs first, then the new app starts
```

Migrations are applied with `prisma migrate deploy` only — never `prisma migrate dev`, `reset`
or `db push` against a customer database. The platform-master seed runs only on first install;
re-run it deliberately (`docker compose run --rm migrate npm run db:seed`) when release notes say
so — it refreshes seeded currencies, countries and catalog entries by key.

### 2.7 Operations checklist

- `docker compose ps` — `app` healthy, `scheduler` running, `migrate` exited 0.
- `curl -fsS https://<host>/api/v1/system/info` → `{"deployment":{"mode":"single-tenant",…}}`.
- Rotate `AUTH_SECRET` (signs everyone out) and `CRON_SECRET` (restart `scheduler`) on staff change.
- Run `npm audit --omit=dev` on each release (see `docs/SECURITY-PRACTICES.md`).

## 3. SaaS deployment (multi-tenant)

### 3.1 Infrastructure (AWS reference)

- **Database:** managed PostgreSQL 15+ (Amazon RDS / Aurora PostgreSQL) with automated backups,
  point-in-time recovery, encryption at rest, Multi-AZ for production. If a connection pooler
  (RDS Proxy / PgBouncer) is used, point `DATABASE_URL` at the pooler and `DIRECT_URL` at the
  instance; Prisma uses `DIRECT_URL` for migrations.
- **App:** the `runner` image on ECS Fargate (or EKS) behind an ALB with TLS (ACM). Two or more
  tasks; health check `GET /api/v1/system/info`.
- **Release job:** run the `migrator` image as a one-off ECS task before shifting traffic
  (`sh scripts/docker-migrate.sh`).
- **Scheduler:** EventBridge Scheduler rules calling `/api/cron/*` with
  `Authorization: Bearer <CRON_SECRET>` on the `vercel.json` schedule (UTC). On Vercel, the
  `crons` in `vercel.json` already do this.
- **Files:** S3 (`STORAGE_PROVIDER=s3`) with a bucket-scoped IAM role.
- **Region:** `me-central-1` (UAE) or `me-south-1` (Bahrain) for GCC data-residency commitments.

### 3.2 Secrets

Store every secret in **AWS Secrets Manager** (or SSM Parameter Store / Doppler) and inject it as
task environment variables — never bake them into the image or commit `.env` files:
`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `CRON_SECRET`, `ENCRYPTION_KEY`,
`STORAGE_SIGNING_SECRET`, `RESEND_API_KEY`, OAuth client secrets, `S3_*`.
Set `SUBHUB_DEPLOYMENT_MODE=saas` as a plain (non-secret) variable. Do not set `AUTH_DEV_OTP`.

### 3.3 Super-admin bootstrap

Run `npm run platform:create-super-admin` once from the migrator task with `SUPER_ADMIN_EMAIL`,
`SUPER_ADMIN_PASSWORD` and `SUPER_ADMIN_NAME` injected from the secret manager (section 4.1). The
operator signs in at `/super-admin/login`. Use dedicated, MFA-protected mailboxes for operators;
keep the number small.

### 3.4 Tenant onboarding

- **Self-service** (`system.allowSelfSignup` on — it is **off by default** — in **Control Panel → Platform settings**): a new
  customer signs up, verifies the email, and creates their own organisation in onboarding
  (they become its ADMIN). Colleagues join by invitation, or by email domain when it matches the
  organisation's primary domain.
- **Operator-led** (self-signup off, the default): **Control Panel → Tenants → Create tenant** creates the
  organisation and its first Tenant Admin in one step (section 4.3).
- **Suspension:** **Tenants → (tenant) → Deactivate** keeps all data but signs members out of the
  organisation (they see a "deactivated" notice); **Reactivate** restores access.
- **Platform masters** (currencies, countries, App catalog) are edited only in
  **Control Panel → Platform masters**; tenants choose which currencies they enable.

### 3.5 Switching modes

The mode is a deployment decision, not a runtime toggle. Moving an on-premise installation to
SaaS: set `SUBHUB_DEPLOYMENT_MODE=saas` and restart — existing role grants stay in the database,
but platform-only permissions stop resolving for tenant users. Moving back restores them.
Before switching, review FleetDM integrations (store `teamId`) and organisation domains.

## 4. Platform Control Panel

The Control Panel is the platform operator's console, separate from the tenant workspace. The
administrator a tenant sees (role ADMIN) is a **Tenant Admin**: it manages one organisation and can
never open the Control Panel. **Platform super admins** are users with role `SUPER_ADMIN` and no
organisation; they are not members of any tenant and never see tenant navigation.

| URL                                                      | Purpose                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `/super-admin/login`                                     | Control Panel sign-in (email or user name + password; optional emailed code)    |
| `/super-admin`                                           | Analytics (all organisations, or one with `?org=`; `?period=`)                  |
| `/super-admin/tenants`                                   | SaaS: tenant list, create (`/new`), detail (`/<id>`)                            |
| `/super-admin/installation`                              | Single-tenant: the installation's organisation (first-run setup if none exists) |
| `/super-admin/admins`                                    | Tenant admins and invitation history (per tenant)                               |
| `/super-admin/platform-admins`                           | Platform super admins                                                           |
| `/super-admin/licence`                                   | Licence and installation ID (read-only)                                         |
| `/super-admin/audit`                                     | Platform audit log (filters: action, record type, actor, tenant, dates)         |
| `/super-admin/masters`, `/settings`, `/extension-builds` | Platform masters, platform settings, extension builds                           |

Access: no session → `/super-admin/login`; a signed-in tenant user (Tenant Admin included) gets a
403 page with a link back to `/dashboard`; a disabled super admin gets a 403 as well. Every server
action re-checks (`requirePlatformAdmin` / `requireSuperAdmin`), so protection does not depend on
the page. After sign-in a super admin always lands in the panel, never in onboarding or a tenant
workspace. The tenant `/api/v1` does not expose platform actions.

### 4.1 Bootstrap the first super admin

Credentials always come from the environment or flags — never from code or seeds:

```bash
# values from .env / the secret manager
npm run platform:create-super-admin            # SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_NAME
npm run platform:create-super-admin -- --email platform@hellopixels.ae --name "Platform Ops" --password '…'
```

- Creates the account, or **resets** it (name, password, re-enable, unlock) when it already exists.
- The password must satisfy the platform password policy (**Platform settings → Security**:
  minimum length and character classes). It is never printed.
- An email that belongs to a tenant user is refused — the CLI never moves a tenant member.
- Each run is recorded in the platform audit log (`BOOTSTRAP_SUPER_ADMIN` / `RESET_SUPER_ADMIN`).
- Docker: the `migrate` job runs the CLI with `--create-only` on every start when both
  `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` are set. It creates the account if it is missing
  and never touches an existing one, so a restart cannot reset a changed password. Still remove
  `SUPER_ADMIN_PASSWORD` from `.env` after the first start; to reset a lost password run the CLI
  without `--create-only`.
- A super admin disabled in **Platform admins** is refused at sign-in.
- `npm run seed:super-admin` remains as an alias for existing runbooks.

Further super admins are added in **Platform admins** (temporary password, changed at the first
sign-in). Super admins can be disabled and have their password reset there; the panel refuses to
disable the last active super admin or your own account.

### 4.2 Single-tenant (on-premise / self-hosted)

- The sidebar shows **Installation** instead of Tenants: the one organisation with the same detail
  as SaaS — status, usage, users by role, defaults, licence limits, Tenant Admins (add another by
  invitation or temporary password, reset an admin's password), profile edit and recent platform
  activity — plus the installation ID.
- While no organisation exists, the page offers **first-run setup**: organisation name, country,
  base currency and time zone (from the platform masters; defaults AE / AED / Asia/Dubai from the
  settings registry) and its first Tenant Admin. First-run by sign-up (section 2.4) still works.
- Creating a second tenant is refused server-side with an explanation; suspend and delete are not
  offered (the installation keeps its organisation).

### 4.3 SaaS (multi-tenant)

- **Tenants** lists every tenant with search, status filter, users, admins, subscriptions, created
  date and last activity (latest member sign-in).
- **Create tenant**: organisation name, optional primary domain, country / base currency / time
  zone from masters, and the first Tenant Admin — either an **invitation** (emailed; when email is
  not configured the link is shown once to share manually) or a **temporary password** that must be
  changed at the next sign-in (typed, or generated and shown once). Default roles, categories,
  payment methods, billing cycles and the country's tax rate are created with the tenant.
- **Tenant detail**: suspend / reactivate (confirmation; `deactivated_at`), delete (type the tenant
  name to confirm), edit profile, add a Tenant Admin, reset a Tenant Admin's password, usage, plan /
  limits and recent platform audit entries.
- **Delete is a soft delete** (`organizations.deleted_at`): the tenant disappears from the panel,
  stays deactivated (members cannot sign in to it), its domain is released and pending invitations
  are cancelled. Data is retained; purging it is a deliberate database operation, not a panel action.

### 4.4 Licensing placeholder

**Licence** shows edition, status, licensee, tenant and per-tenant user limits with current usage,
expiry, licensed features, deployment mode and the **installation ID** (generated once, stored in
`system_settings` under `platform.installationId`). The page is read-only and states "Managed by the
HelloPixels licensing application".

Code reads every limit through `src/lib/licensing` (`getLicense()`, `checkLimit()`), backed by a
`LicenseProvider`. The default `CommunityLicenseProvider` is an unlicensed community edition with
no limits and no expiry, so nothing is enforced today; tenant creation already asks the provider
for `maxTenants`. The HelloPixels licensing application will register its own provider
(`setLicenseProvider`) bound to the installation ID — no other code changes are needed.

### 4.5 Audit

Every Control Panel action writes `platform_audit_logs`: tenant create / update / suspend /
reactivate / delete; Tenant Admin invite / create / role change / password reset / invitation
resend; super admin create / disable / enable / password reset; platform settings; platform
masters; extension builds. Entries about a tenant carry its id (`entity_id` or
`metadata.organizationId`), which the tenant detail page and the tenant filter use. Passwords and
secrets are never written to the log. Page size: `system.platformAuditPageSize`.
