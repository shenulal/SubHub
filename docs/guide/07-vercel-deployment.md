# Vercel Deployment Guide

## Overview

This guide describes how to deploy SubHub to Vercel.

---

## 1. Prerequisites

### 1.1 Required Accounts

- A [Vercel](https://vercel.com) account
- A [Supabase](https://supabase.com) project (PostgreSQL)
- A [Google Cloud Console](https://console.cloud.google.com) project (OAuth)

### 1.2 Verify the Local Environment

```bash
# Build test
npm run build

# Quality checks
npm run quality
```

---

## 2. Environment Variable Configuration

### 2.1 Required Environment Variables (Phase 4 Deployment)

| Variable name          | Description                           | How to obtain                    |
| ---------------------- | ------------------------------------- | -------------------------------- |
| `DATABASE_URL`         | Supabase PostgreSQL connection string | Supabase > Settings > Database   |
| `NEXTAUTH_SECRET`      | NextAuth session encryption key       | `openssl rand -base64 32`        |
| `NEXTAUTH_URL`         | Application URL                       | `https://your-domain.vercel.app` |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                | Google Cloud Console             |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret            | Google Cloud Console             |

### 2.2 Optional Environment Variables (Sprint 2+)

| Variable name               | Description                      | When required             |
| --------------------------- | -------------------------------- | ------------------------- |
| `GOOGLE_ADMIN_CLIENT_EMAIL` | Google Workspace service account | For SSO integration       |
| `GOOGLE_ADMIN_PRIVATE_KEY`  | Service account Private Key      | For SSO integration       |
| `GOOGLE_ADMIN_SUBJECT`      | Admin email                      | For SSO integration       |
| `UPSTASH_REDIS_REST_URL`    | Redis URL                        | When caching is needed    |
| `UPSTASH_REDIS_REST_TOKEN`  | Redis token                      | When caching is needed    |
| `RESEND_API_KEY`            | Email API key                    | For notification features |
| `RESEND_FROM_EMAIL`         | Sender email                     | For notification features |
| `R2_ACCOUNT_ID`             | Cloudflare R2 account ID         | For file uploads          |
| `R2_ACCESS_KEY_ID`          | R2 Access Key                    | For file uploads          |
| `R2_SECRET_ACCESS_KEY`      | R2 Secret Key                    | For file uploads          |
| `R2_BUCKET_NAME`            | R2 bucket name                   | For file uploads          |
| `CRON_SECRET`               | Cron Job authentication key      | When using Cron           |

---

## 3. Supabase Configuration

### 3.1 Create a Project

1. Create a new project in the [Supabase Dashboard](https://supabase.com/dashboard)
2. Copy the Connection String from **Settings > Database**
3. Replace `[YOUR-PASSWORD]` with the actual password

### 3.2 DATABASE_URL Format

```
postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

### 3.3 Apply Migrations

```bash
# Generate the Prisma client locally
npm run db:generate

# Apply the schema to the production DB
npm run db:push
```

---

## 4. Google OAuth Configuration

### 4.1 Google Cloud Console Setup

1. Open the [Google Cloud Console](https://console.cloud.google.com)
2. Go to **APIs & Services > Credentials**
3. Click **+ CREATE CREDENTIALS > OAuth client ID**
4. Application type: select **Web application**

### 4.2 OAuth Settings

**Authorized JavaScript origins:**

```
https://your-domain.vercel.app
```

**Authorized redirect URIs:**

```
https://your-domain.vercel.app/api/auth/callback/google
```

### 4.3 Copy into Environment Variables

- **Client ID** → `GOOGLE_CLIENT_ID`
- **Client secret** → `GOOGLE_CLIENT_SECRET`

---

## 5. Vercel Deployment

### 5.1 Connect GitHub

1. In the [Vercel Dashboard](https://vercel.com/dashboard), choose **Add New > Project**
2. Select the GitHub repository
3. Click **Import**

### 5.2 Project Settings

| Setting          | Value           |
| ---------------- | --------------- |
| Framework Preset | Next.js         |
| Root Directory   | `./`            |
| Build Command    | `npm run build` |
| Install Command  | `npm ci`        |
| Output Directory | `.next`         |

### 5.3 Enter Environment Variables

Add the following variables in the **Environment Variables** section:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (set automatically, but adding it explicitly is recommended)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### 5.4 Deploy

1. Click **Deploy**
2. Review the build log
3. Confirm the URL once deployment completes

---

## 6. Post-Deployment Verification

### 6.1 Basic Functional Test

1. Open the deployed URL
2. Confirm the redirect to `/login`
3. Attempt a Google sign-in
4. Confirm the redirect to `/onboarding` (first sign-in)
5. Create an organisation and confirm access to `/dashboard`

### 6.2 If Problems Occur

1. Check **Vercel > Project > Logs**
2. Re-check the environment variable configuration
3. Verify the Google OAuth Redirect URI

---

## 7. Domain Configuration (Optional)

### 7.1 Add a Custom Domain

1. **Vercel > Project > Settings > Domains**
2. Add the domain (e.g. `smp.yourdomain.com`)
3. Configure DNS (CNAME or A record)

### 7.2 Update Environment Variables

When using a custom domain, update the following:

- `NEXTAUTH_URL` → `https://smp.yourdomain.com`
- Update the Google OAuth Redirect URI

---

## 8. CI/CD Automation

### 8.1 Automatic Deployment (Default)

- Push to the `main` branch → automatic production deployment
- Open a PR → a Preview deployment is created automatically

### 8.2 Recommended Branch Protection Settings

- No direct pushes to the `main` branch
- PR required + at least 1 reviewer
- CI must pass (`npm run quality`)

---

## Checklist

### Before Deployment

- [ ] `npm run build` succeeds
- [ ] `npm run quality` passes
- [ ] Supabase project created
- [ ] Google OAuth credentials created
- [ ] `NEXTAUTH_SECRET` generated

### During Deployment

- [ ] All Vercel environment variables set
- [ ] Google OAuth Redirect URI added

### After Deployment

- [ ] Sign-in flow tested
- [ ] Organisation creation tested
- [ ] Dashboard access tested

---

## 9. Git Author Configuration (Important)

One of the main causes of failed Vercel deployments is a Git commit email that does not match the Vercel account.

```bash
# Check the current setting
git config user.email

# Set it to the Vercel account email
git config user.email "your-vercel-account@example.com"
```

See [12-git-workflow.md](./12-git-workflow.md) for details.

---

## Related Documents

- [06-coverage-checklist.md](./06-coverage-checklist.md) - Pre-PR quality checks
- [12-git-workflow.md](./12-git-workflow.md) - Git workflow and deployment integration
