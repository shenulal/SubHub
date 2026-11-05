# SubHub — Credential and Security Practices

## Where secrets live

| Secret                                                       | Source                        | Notes                                                                                   |
| ------------------------------------------------------------ | ----------------------------- | --------------------------------------------------------------------------------------- |
| `DATABASE_URL`, `DIRECT_URL`                                 | Environment / secret manager  | Never in code or docs                                                                   |
| `NEXTAUTH_SECRET`                                            | Environment                   | ≥ 32 random bytes (`openssl rand -base64 32`)                                           |
| `ENCRYPTION_KEY`                                             | Environment                   | 32 characters; encrypts mailbox OAuth tokens at rest (AES-256-GCM, `src/lib/crypto.ts`) |
| `STORAGE_SIGNING_SECRET`                                     | Environment                   | Signs local-storage download URLs; falls back to `NEXTAUTH_SECRET`                      |
| `CRON_SECRET`                                                | Environment                   | Bearer token checked by every `/api/cron/*` route                                       |
| OAuth client secrets (Google, Apple, Gmail, Microsoft Graph) | Environment                   | Providers are enabled only when their variables exist                                   |
| `RESEND_API_KEY`, `FCM_SERVER_KEY`, `S3_*`, `FX_API_KEY`     | Environment                   | Optional integrations degrade gracefully when absent                                    |
| Organisation-level secrets (`finance.fxApiKey`)              | `organization_settings` table | Masked before reaching the browser (`maskSensitiveSettings`); audit log redacts values  |

## Rules

1. **No secrets in git.** `.env*` is ignored (only `.env.example` with placeholders is tracked). The pre-commit hook runs `scripts/check-secrets.mjs` over staged files and blocks private keys, cloud/API tokens, OAuth client secrets, and database URLs with passwords.
2. **Production uses a secret manager**, not files: Vercel project environment variables, AWS Secrets Manager / Parameter Store, or Doppler. Inject at deploy time; rotate on staff change or suspected exposure.
3. **Rotation.** `NEXTAUTH_SECRET` rotation signs users out; `ENCRYPTION_KEY` rotation requires re-connecting mailboxes (tokens cannot be decrypted with a new key) — plan a re-consent window; `CRON_SECRET` rotation must be mirrored in the scheduler.
4. **Least privilege.** Database user limited to the application schema; S3/R2 keys scoped to the single bucket; Gmail scope is `gmail.readonly`, Graph scope `Mail.Read`.
5. **Transport and headers.** HTTPS only (`NEXTAUTH_URL` must be https in production); `trustHost` is enabled for proxies; set HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and a CSP at the edge (`next.config.ts` headers or the CDN).
6. **Sessions.** JWT sessions; lifetime from `security.sessionMaxAgeHours`; SSO can be enforced per organisation (`security.enforceSso`); public sign-up can be disabled platform-wide (`system.allowSelfSignup`).
7. **Access control.** Every server action and API route calls `requirePermission`; roles are organisation-scoped; the last administrator cannot be demoted.
8. **Audit.** Create / update / delete / decision / export / settings changes are written to `audit_logs` with secrets redacted; retention is configurable (`privacy.auditLogRetentionDays`).
9. **Dependencies.** `npm audit --omit=dev` is part of the release checklist; critical/high advisories on direct dependencies are fixed before release (see the build log in `README.md`).
10. **Uploads.** Attachments are validated for size and MIME type against settings, stored under tenant-scoped keys, served only through signed URLs, and never executed.

## Local development

`.env.local` holds local values only. The QA seed (`scripts/seed-smoke.ts`) creates throw-away accounts on the `subhub-qa.test` domain; never run it against production.

`AUTH_DEV_OTP` (a fixed 6-digit sign-in code) lets local and QA users sign in without an email provider. It is honoured only in development or when `NEXTAUTH_URL` points at localhost (a production build previewed on this machine); `src/actions/otp-dev.ts` rejects it for any other host. Never set it in a deployed environment's secret store. Without `RESEND_API_KEY`, local environments write the one-time code to the server log instead of emailing it.
