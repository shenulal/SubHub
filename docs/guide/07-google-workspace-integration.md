# Google Workspace Integration Guide

> **Document purpose**: Setup and troubleshooting guide for the Google Workspace Admin SDK integration
> **Date written**: 2025-12-11
> **Status**: ✅ Implemented

---

## 1. Overview

### 1.1 Feature Description

The Google Workspace integration provides the following capabilities:

| Capability                | Description                                                            |
| ------------------------- | ---------------------------------------------------------------------- |
| **User sync**             | Automatically imports Google Workspace users and stores them in the DB |
| **Team (OU) sync**        | Converts the Organizational Unit structure into the Team model         |
| **OAuth token lookup**    | Discovers connected apps per user (SaaS Discovery)                     |
| **Admin privilege check** | Syncs whether a user is a Google Workspace Super Admin                 |

### 1.2 Architecture

```
Google Workspace Admin API
         ↓
┌────────────────────────────────────────┐
│     GoogleWorkspaceService             │
│  (src/lib/services/sso/googleWorkspace.ts)
├────────────────────────────────────────┤
│ - listUsers()      List users          │
│ - listOrgUnits()   List OUs            │
│ - listTokens()     List OAuth tokens   │
│ - testConnection() Test connection     │
└────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────┐
│     fullGoogleWorkspaceSync            │
│  (src/lib/services/sso/googleSync.ts)  │
├────────────────────────────────────────┤
│ 1. Team sync (OU → Team)               │
│ 2. User sync (incl. extended fields)   │
│ 3. Manager relationships (2-pass)      │
└────────────────────────────────────────┘
         ↓
    PostgreSQL (Prisma)
```

---

## 2. Prerequisites (Google Cloud Console)

### 2.1 Create a Service Account

1. Open the [Google Cloud Console](https://console.cloud.google.com)
2. **IAM & Admin** → **Service Accounts** → **Create Service Account**
3. Enter a service account name (e.g. `smp-workspace-directory-sync`)
4. **Create and Continue** → no role needs to be selected → **Done**

### 2.2 Issue a JSON Key

1. Click the newly created service account
2. **Keys** tab → **Add Key** → **Create new key**
3. Select **JSON** → **Create**
4. Store the downloaded JSON file securely

JSON file structure:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "smp-workspace@your-project.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  ...
}
```

### 2.3 Enable Domain-Wide Delegation

1. Service account details page → expand **Advanced settings**
2. **Domain-wide Delegation** section
3. Tick **Enable Google Workspace Domain-wide Delegation** (skip if already enabled)
4. Copy the **Client ID** (numeric, e.g. `110467399430507439402`)

---

## 3. Prerequisites (Google Admin Console)

### 3.1 Authorise API Scopes

1. Open the [Google Admin Console](https://admin.google.com) (with a Super Admin account)
2. **Security** → **Access and data control** → **API controls**
3. **Domain-wide delegation** → **MANAGE DOMAIN WIDE DELEGATION**
4. Click **Add new**

### 3.2 Register the Client ID and Scopes

| Field            | Value                                              |
| ---------------- | -------------------------------------------------- |
| **Client ID**    | The Client ID copied from the Google Cloud Console |
| **OAuth scopes** | The 3 scopes below (comma-separated)               |

```
https://www.googleapis.com/auth/admin.directory.user.readonly,https://www.googleapis.com/auth/admin.directory.user.security,https://www.googleapis.com/auth/admin.directory.orgunit.readonly
```

5. Click **Authorize**

**Note**: The settings may take 1–2 minutes to take effect.

---

## 4. Adding the Integration in the App

### 4.1 Required Information

| Field                     | Description                                 | Example                               |
| ------------------------- | ------------------------------------------- | ------------------------------------- |
| **Admin email**           | Google Workspace Super Admin email          | `admin@company.com`                   |
| **Service account email** | The `client_email` value from the JSON file | `smp@project.iam.gserviceaccount.com` |
| **Private Key**           | The `private_key` value from the JSON file  | `-----BEGIN PRIVATE KEY-----...`      |

### 4.2 Steps to Add the Integration

1. Go to the `/integrations` page
2. Click the **Add Integration** button
3. Integration type: select **Google Workspace**
4. Enter the required information
5. Click **Add Integration**

### 4.3 Entering the Private Key

When copying the `private_key` value from the JSON file:

```json
"private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...\n-----END PRIVATE KEY-----\n"
```

- **You may copy it including the quotation marks**: the system strips them automatically
- **You may copy the \n escape sequences as they are**: the system converts them to real line breaks automatically

---

## 5. Troubleshooting

### 5.1 Error: `unauthorized_client`

```
Client is unauthorized to retrieve access tokens using this method,
or client not authorized for any of the scopes requested.
```

**Cause**: The API scopes have not been authorised in the Google Admin Console

**Resolution**:

1. Google Admin Console → Security → API controls → Domain-wide delegation
2. Confirm that the Client ID and scopes are registered correctly
3. Confirm that all 3 scopes are included exactly
4. Wait 1–2 minutes after saving the settings, then retry

### 5.2 Error: `invalid_grant: Invalid signature for token`

```
java.security.SignatureException: Invalid signature for token
```

**Cause**: The Private Key does not match the service account

**Resolution**:

1. Create a new key in the Google Cloud Console
2. Delete the old key and retry with the new key
3. Confirm the Private Key has not been corrupted (it can be altered during copy/paste)

### 5.3 Error: `ERR_OSSL_UNSUPPORTED`

```
error:1E08010C:DECODER routines::unsupported
```

**Cause**: Private Key format error (e.g. surrounding quotation marks included)

**Resolution**:

- The system has been updated to handle this automatically
- If it still occurs, open the Private Key in a text editor and check its format

### 5.4 Error: `Not Authorized`

**Cause**: The admin email (subject) does not have Super Admin privileges

**Resolution**:

- Confirm in the Google Admin Console that the account is a Super Admin
- Try a different Super Admin account

---

## 6. Related Code

### 6.1 Key Files

| File                                                        | Description                |
| ----------------------------------------------------------- | -------------------------- |
| `src/lib/services/sso/googleWorkspace.ts`                   | Google Admin SDK client    |
| `src/lib/services/sso/googleSync.ts`                        | Unified sync service       |
| `src/lib/services/sso/userSync.ts`                          | User sync logic            |
| `src/lib/services/sso/teamSync.ts`                          | Team (OU) sync logic       |
| `src/actions/integrations.ts`                               | Integration Server Actions |
| `src/components/integrations/integration-create-dialog.tsx` | Add-integration dialog     |

### 6.2 Private Key Normalisation Logic

Handled in `src/actions/integrations.ts`:

```typescript
// Private Key normalisation:
// 1. Trim leading/trailing whitespace
// 2. Strip leading/trailing quotation marks (may be included when copied from JSON)
// 3. Convert the literal \n sequence into real line breaks
let normalizedPrivateKey = creds.privateKey?.trim();
if (normalizedPrivateKey) {
  // Strip leading/trailing quotation marks (", ')
  normalizedPrivateKey = normalizedPrivateKey.replace(/^["']|["']$/g, "");
  // Convert \n escape sequences into real line breaks
  normalizedPrivateKey = normalizedPrivateKey.replace(/\\n/g, "\n");
}
```

### 6.3 API Scopes

```typescript
scopes: [
  "https://www.googleapis.com/auth/admin.directory.user.readonly",
  "https://www.googleapis.com/auth/admin.directory.user.security",
  "https://www.googleapis.com/auth/admin.directory.orgunit.readonly",
];
```

---

## 7. Future Improvements

### 7.1 Google Workspace Marketplace App Listing

Currently, users must create a Service Account themselves and configure Domain-Wide Delegation.

**Improvement plan**:

- List the app on the Google Workspace Marketplace
- Enable one-step integration through the OAuth consent screen alone
- Reference: https://developers.google.com/workspace/marketplace

### 7.2 Additional Integration Support

| IdP                |   Status   | Priority |
| ------------------ | :--------: | :------: |
| Google Workspace   |  ✅ Done   |    -     |
| Okta               | 🔜 Planned |    P1    |
| Microsoft Entra ID | 🔜 Planned |    P1    |

---

## 8. References

- [Google Admin SDK Directory API](https://developers.google.com/admin-sdk/directory)
- [Domain-Wide Delegation guide](https://developers.google.com/admin-sdk/directory/v1/guides/delegation)
- [Google Workspace Team Sync implementation report](../plan/complete/google-workspace-team-sync-plan.md)
