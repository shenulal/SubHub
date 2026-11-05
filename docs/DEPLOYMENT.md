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
| Public sign-up form             | Open during first-run setup; afterwards follows `system.allowSelfSignup`.                                                                                                      | Follows `system.allowSelfSignup`.                                                                                                                                   |
| Platform-wide permissions       | `masters:manage_global` and `catalog:manage` stay with the organisation ADMIN (it is their installation).                                                                      | Platform-only: stripped from every tenant role (system and custom) by the permission resolver and hidden in the role editor. Only SUPER_ADMIN holds them.           |
| Shared exchange-rate table      | Manual rates / provider refresh need `masters:manage`.                                                                                                                         | Additionally need `masters:manage_global` (platform-only); the daily `exchange-rates` job keeps rates current.                                                      |
| OS default apps, catalog verify | Organisation ADMIN maintains the shared lists.                                                                                                                                 | Tenants cannot change shared lists; approving an app does not mark the shared catalog entry verified.                                                               |
| Sign-in page SSO rule           | The installation's organisation setting `security.enforceSso`.                                                                                                                 | The platform (system) value — never "the first organisation".                                                                                                       |
| FleetDM webhook without team    | Falls back to the only active FleetDM integration.                                                                                                                             | Never guesses: the integration must store `credentials.teamId`; otherwise the event is logged and skipped.                                                          |
| Super-admin console             | Shows the single organisation (create only while none exists), administrators, extension builds, platform masters, platform settings.                                          | Tenant list, create, view/edit, deactivate/reactivate; a tenant selector on overview, administrators and extension builds; platform masters; platform settings.     |

Platform-wide changes made by a SUPER_ADMIN (tenants, currencies, countries, vendor catalog)
are recorded in `platform_audit_logs`; changes made inside an organisation stay in its `audit_logs`.

## 2. On-premise / self-hosted install (single tenant)

### 2.1 Requirements

- Docker Engine 24+ with the Compose plugin (or Podman with `podman compose`).
- 2 vCPU / 4 GB RAM minimum for the app and Postgres; build the image on a machine with 8 GB.
- A DNS name and a TLS-terminating reverse proxy (nginx, Traefik, Caddy, or a load balancer).
- An SMTP-capable email provider through Resend (`RESEND_API_KEY`) for sign-in codes and notifications.

### 2.2 Configure

```bash
cp .env.example .env
```

Set at least:

| Variable                                               | Value                                                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `SUBHUB_DEPLOYMENT_MODE`                               | `single-tenant` (default; may be omitted)                                                               |
| `POSTGRES_PASSWORD`                                    | Long random password for the bundled Postgres (`openssl rand -base64 24`)                               |
| `AUTH_SECRET`                                          | `openssl rand -base64 32` — the server refuses to start in production without it (or `NEXTAUTH_SECRET`) |
| `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`                  | The public `https://` URL users open                                                                    |
| `CRON_SECRET`                                          | `openssl rand -base64 32` — used by the `scheduler` service                                             |
| `ENCRYPTION_KEY`                                       | 32 random characters — encrypts mailbox and card credentials at rest                                    |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`      | Email delivery                                                                                          |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (optional) | Google sign-in                                                                                          |
| `STORAGE_PROVIDER`                                     | `local` (default, stored in the `app_storage` volume) or `s3` / `r2` with the `S3_*` values             |

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
   even if `system.allowSelfSignup` is off).
2. Verify the email, sign in, and complete onboarding. That user creates **the** organisation and
   becomes its ADMIN. Onboarding then stops offering "create organisation" to anyone.
3. Invite colleagues from **Users → Invite**. Optionally add the company domains in
   **Settings → Organisation**; with self-signup on, people with those email domains join
   automatically as members.
4. Optional platform operator account (super-admin console at `/super-admin`):
   `docker compose run --rm -e SUPER_ADMIN_EMAIL=ops@customer.com migrate npm run seed:super-admin`.

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

```bash
SUPER_ADMIN_EMAIL=platform@hellopixels.ae npm run seed:super-admin   # from the migrator task
```

The SUPER_ADMIN signs in with an emailed code (or the optional `SUPER_ADMIN_PASSWORD`) and lands in
`/super-admin`. Use dedicated, MFA-protected mailboxes for operators; keep the number small.

### 3.4 Tenant onboarding

- **Self-service** (`system.allowSelfSignup` on, in **Super Admin → Platform settings**): a new
  customer signs up, verifies the email, and creates their own organisation in onboarding
  (they become its ADMIN). Colleagues join by invitation, or by email domain when it matches the
  organisation's primary domain.
- **Operator-led** (self-signup off): **Super Admin → Tenants → Create Tenant**, then
  **Admin Management** (choose the tenant) → invite the customer's first administrator.
- **Suspension:** **Tenants → Deactivate** keeps all data but signs members out of the
  organisation (they see a "deactivated" notice); **Reactivate** restores access.
- **Platform masters** (currencies, countries, vendor catalog) are edited only in
  **Super Admin → Platform masters**; tenants choose which currencies they enable.

### 3.5 Switching modes

The mode is a deployment decision, not a runtime toggle. Moving an on-premise installation to
SaaS: set `SUBHUB_DEPLOYMENT_MODE=saas` and restart — existing role grants stay in the database,
but platform-only permissions stop resolving for tenant users. Moving back restores them.
Before switching, review FleetDM integrations (store `teamId`) and organisation domains.
