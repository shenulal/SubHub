# Corporate Account Transaction History API Guide

This guide covers integrating the Hyphen Corporate Account Inquiry API to retrieve the transaction history of corporate bank accounts.

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Authentication (OAuth 2.0)](#3-authentication-oauth-20)
4. [API Specification](#4-api-specification)
5. [Bank Code Table](#5-bank-code-table)
6. [Use Cases](#6-use-cases)
7. [Error Handling and Considerations](#7-error-handling-and-considerations)

---

## 1. Overview

### 1.1 What Is the Corporate Account Inquiry API?

Hyphen's Corporate Account Inquiry API is a scraping-based API that retrieves bank account information for corporations and sole proprietors. Using internet/corporate banking credentials, it can retrieve account balances, transaction history, the list of held accounts, and more.

```
[Available information]
- List of held accounts (all-accounts inquiry)
- Real-time balance and withdrawable amount per account
- Deposit/withdrawal transaction history (date/time, amount, counterparty name, memo)
- Transfer result confirmation
```

### 1.2 Hyphen Corporate Account Inquiry API

[Hyphen](https://hyphen.im)'s Corporate Account Inquiry API provides a consolidated view of account information across multiple banks.

- **API documentation**: https://hyphen.im/product-api/view?seq=54
- **Supported banks**: 20+ major Korean banks (including commercial banks and non-bank financial institutions)
- **Security certification**: ISMS (Information Security Management System) certified

### 1.3 Use in SubHub

| Purpose                          | Description                                                        |
| -------------------------------- | ------------------------------------------------------------------ |
| **SaaS payment tracking**        | Automatically collect SaaS subscription fees paid by bank transfer |
| **Cash position visibility**     | Monitor cash flow using real-time account balances                 |
| **Unified payment history**      | Manage corporate card and bank transfer payments in one place      |
| **Cost analysis**                | Aggregate costs per SaaS service based on counterparty name        |
| **Anomalous transaction alerts** | Alert on unexpected withdrawals                                    |

### 1.4 Available APIs

| API                                       | Endpoint             | Function                                       | Primary Use                 |
| ----------------------------------------- | -------------------- | ---------------------------------------------- | --------------------------- |
| Corporate Account Balance Inquiry         | `POST /in0087000482` | Retrieve account balance / withdrawable amount | Real-time cash position     |
| **Corporate Account Transaction History** | `POST /in0087000483` | Retrieve deposit/withdrawal history            | Confirm SaaS payments       |
| Corporate All-Accounts Inquiry            | `POST /in0087000519` | Retrieve list of held accounts                 | Identify accounts to manage |
| Corporate Account Transfer Result Inquiry | `POST /in0087001420` | Confirm transfer results                       | Track payment status        |

---

## 2. Prerequisites

### 2.1 Hyphen Sign-Up and Product Application

1. [Sign up for Hyphen](https://hyphen.im/user/sign-up)
2. After logging in, apply for the "Corporate Account Inquiry" product
3. Credentials are issued (the Hkey is delivered by email)

### 2.2 Choose a Pricing Plan

| Plan             | Characteristics                       | Billing Method                            |
| ---------------- | ------------------------------------- | ----------------------------------------- |
| **TR Slim**      | Use immediately, no contract required | Prepaid; deducted from topped-up BizMoney |
| **TR Signature** | Contract required                     | Postpaid invoicing                        |

> **Testing**: Free testing is provided for 100 calls per day and 100 calls per month

### 2.3 Prepare Credentials

```
user_id: The ID created at sign-up
hkey: The security key delivered by email after sign-up
```

### 2.4 Bank Credentials

Querying a corporate account requires the internet/corporate banking credentials for the relevant bank.

#### ID Login Method

```typescript
interface IdLoginCredential {
  loginType: "ID"; // Login type
  userId: string; // Bank website ID
  userPw: string; // Bank website password
}
```

#### Certificate Login Method

```typescript
interface CertLoginCredential {
  loginType: "CERT"; // Login type
  signCert: string; // Korean joint certificate (Base64)
  signPri: string; // Private key (Base64)
  signPw: string; // Certificate password
}
```

---

## 3. Authentication (OAuth 2.0)

### 3.1 Issue an Access Token

**Endpoint**

```
POST https://api.hyphen.im/oauth/token
```

**Request**

```typescript
// Header
{ "Content-Type": "application/json" }

// Body
{
  "user_id": "your_user_id",
  "hkey": "your_hkey"
}
```

**Response**

```typescript
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "expiresIn": 604800  // 7 days (in seconds)
}
```

### 3.2 Token Management

```typescript
// lib/hyphen-auth.ts
interface TokenInfo {
  accessToken: string;
  expiresAt: Date;
}

let tokenCache: TokenInfo | null = null;

export async function getAccessToken(): Promise<string> {
  // Re-issue if there is no token or it is about to expire
  if (!tokenCache || isExpiringSoon(tokenCache.expiresAt)) {
    tokenCache = await refreshToken();
  }
  return tokenCache.accessToken;
}

function isExpiringSoon(expiresAt: Date): boolean {
  const buffer = 60 * 60 * 1000; // Refresh 1 hour ahead of expiry
  return Date.now() > expiresAt.getTime() - buffer;
}

async function refreshToken(): Promise<TokenInfo> {
  const response = await fetch("https://api.hyphen.im/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: process.env.HYPHEN_USER_ID,
      hkey: process.env.HYPHEN_HKEY,
    }),
  });

  const data = await response.json();
  return {
    accessToken: data.accessToken,
    expiresAt: new Date(Date.now() + data.expiresIn * 1000),
  };
}
```

### 3.3 Authentication Headers for API Calls

```typescript
// Bearer token method
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${accessToken}`,
};

// Or the direct authentication method
const headers = {
  "Content-Type": "application/json",
  "user-id": "your_user_id",
  Hkey: "your_hkey",
};
```

---

## 4. API Specification

### 4.1 Corporate Account Balance Inquiry

Retrieves the current balance and withdrawable amount of an account.

**Endpoint**

```
POST https://api.hyphen.im/in0087000482
```

**Request**

```typescript
interface BalanceRequest {
  // Bank credentials
  bankCd: string; // Bank code (e.g. "004" KB Kookmin Bank)
  loginType: "ID" | "CERT"; // Login method
  userId?: string; // For ID login
  userPw?: string; // For ID login
  signCert?: string; // For certificate login
  signPri?: string; // For certificate login
  signPw?: string; // For certificate login

  // Query details
  acctNo: string; // Account number (digits only)
}
```

**Response**

```typescript
interface BalanceResponse {
  code: string; // Result code ("00000": success)
  message: string; // Result message
  data: {
    bankCd: string; // Bank code
    acctNo: string; // Account number
    acctNm: string; // Account name
    balance: string; // Current balance
    availableAmt: string; // Withdrawable amount
    lastTrDt: string; // Last transaction date (YYYYMMDD)
    lastTrTm: string; // Last transaction time (HHmmss)
  };
}
```

**Example**

```typescript
// Balance inquiry function
async function getAccountBalance(
  bankCd: string,
  acctNo: string,
  credential: IdLoginCredential | CertLoginCredential
): Promise<BalanceResponse> {
  const accessToken = await getAccessToken();

  const response = await fetch("https://api.hyphen.im/in0087000482", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      bankCd,
      acctNo,
      ...credential,
    }),
  });

  return response.json();
}

// Usage example
const balance = await getAccountBalance("004", "12345678901234", {
  loginType: "ID",
  userId: "bank_user",
  userPw: "bank_password",
});

console.log(`Balance: ${Number(balance.data.balance).toLocaleString()} KRW`);
console.log(
  `Withdrawable amount: ${Number(balance.data.availableAmt).toLocaleString()} KRW`
);
```

---

### 4.2 Corporate Account Transaction History (Core)

Retrieves deposit/withdrawal transactions for a specified period. This is the core API for SaaS payment tracking.

**Endpoint**

```
POST https://api.hyphen.im/in0087000483
```

**Request**

```typescript
interface TransactionRequest {
  // Bank credentials
  bankCd: string; // Bank code
  loginType: "ID" | "CERT"; // Login method
  userId?: string; // For ID login
  userPw?: string; // For ID login
  signCert?: string; // For certificate login
  signPri?: string; // For certificate login
  signPw?: string; // For certificate login

  // Query conditions
  acctNo: string; // Account number
  startDt: string; // Query start date (YYYYMMDD)
  endDt: string; // Query end date (YYYYMMDD)
  trType?: string; // Transaction type ("A": all, "I": deposits, "O": withdrawals)
  pageNo?: string; // Page number
  pageSize?: string; // Page size
}
```

**Response**

```typescript
interface TransactionResponse {
  code: string; // Result code ("00000": success)
  message: string; // Result message
  data: {
    totalCount: string; // Total record count
    list: TransactionItem[];
  };
}

interface TransactionItem {
  trDt: string; // Transaction date (YYYYMMDD)
  trTm: string; // Transaction time (HHmmss)
  trNo: string; // Transaction number
  trType: string; // Transaction type ("I": deposit, "O": withdrawal)
  inAmt: string; // Deposit amount
  outAmt: string; // Withdrawal amount
  balance: string; // Balance after transaction
  trNm: string; // Counterparty name (depositor/payee)
  memo: string; // Memo (transaction description)
  branchNm?: string; // Transacting branch name
  recvAcctNo?: string; // Counterparty account number
  recvAcctHolder?: string; // Counterparty account holder name
}
```

**Example**

```typescript
// Transaction history inquiry function
async function getTransactions(
  bankCd: string,
  acctNo: string,
  startDt: string,
  endDt: string,
  credential: IdLoginCredential | CertLoginCredential,
  options?: { trType?: string; pageNo?: string; pageSize?: string }
): Promise<TransactionResponse> {
  const accessToken = await getAccessToken();

  const response = await fetch("https://api.hyphen.im/in0087000483", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      bankCd,
      acctNo,
      startDt,
      endDt,
      trType: options?.trType || "A",
      pageNo: options?.pageNo || "1",
      pageSize: options?.pageSize || "100",
      ...credential,
    }),
  });

  return response.json();
}

// Usage example: retrieve this month's withdrawals
const today = new Date();
const startDt = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}01`;
const endDt = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

const transactions = await getTransactions(
  "004",
  "12345678901234",
  startDt,
  endDt,
  { loginType: "ID", userId: "bank_user", userPw: "bank_password" },
  { trType: "O" } // Withdrawals only
);

// Print the transactions
transactions.data.list.forEach((tr) => {
  console.log(
    `${tr.trDt} ${tr.trTm} | ${tr.trNm} | -${Number(tr.outAmt).toLocaleString()} KRW`
  );
});
```

---

### 4.3 Corporate All-Accounts Inquiry

Retrieves the list of all accounts held under the registered bank credentials.

**Endpoint**

```
POST https://api.hyphen.im/in0087000519
```

**Request**

```typescript
interface AllAccountsRequest {
  // Bank credentials
  bankCd: string; // Bank code
  loginType: "ID" | "CERT"; // Login method
  userId?: string; // For ID login
  userPw?: string; // For ID login
  signCert?: string; // For certificate login
  signPri?: string; // For certificate login
  signPw?: string; // For certificate login
}
```

**Response**

```typescript
interface AllAccountsResponse {
  code: string; // Result code
  message: string; // Result message
  data: {
    list: AccountInfo[];
  };
}

interface AccountInfo {
  bankCd: string; // Bank code
  bankNm: string; // Bank name
  acctNo: string; // Account number
  acctNm: string; // Account name (e.g. ordinary savings, corporate free savings)
  acctType: string; // Account type
  balance: string; // Current balance
  availableAmt: string; // Withdrawable amount
  regDt?: string; // Account opening date
}
```

**Example**

```typescript
// All-accounts inquiry function
async function getAllAccounts(
  bankCd: string,
  credential: IdLoginCredential | CertLoginCredential
): Promise<AllAccountsResponse> {
  const accessToken = await getAccessToken();

  const response = await fetch("https://api.hyphen.im/in0087000519", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      bankCd,
      ...credential,
    }),
  });

  return response.json();
}

// Usage example
const accounts = await getAllAccounts("004", {
  loginType: "ID",
  userId: "bank_user",
  userPw: "bank_password",
});

console.log("Held accounts:");
accounts.data.list.forEach((acct) => {
  console.log(
    `- ${acct.acctNm} (${acct.acctNo}): ${Number(acct.balance).toLocaleString()} KRW`
  );
});
```

---

### 4.4 Corporate Account Transfer Result Inquiry

Retrieves the result of a specific transfer transaction.

**Endpoint**

```
POST https://api.hyphen.im/in0087001420
```

**Request**

```typescript
interface TransferResultRequest {
  // Bank credentials
  bankCd: string; // Bank code
  loginType: "ID" | "CERT"; // Login method
  userId?: string;
  userPw?: string;
  signCert?: string;
  signPri?: string;
  signPw?: string;

  // Query conditions
  acctNo: string; // Debit (withdrawal) account number
  trDt: string; // Transfer date (YYYYMMDD)
  trNo?: string; // Transaction number (optional)
}
```

**Response**

```typescript
interface TransferResultResponse {
  code: string;
  message: string;
  data: {
    list: TransferResult[];
  };
}

interface TransferResult {
  trDt: string; // Transfer date
  trTm: string; // Transfer time
  trNo: string; // Transaction number
  outAcctNo: string; // Debit account number
  recvBankCd: string; // Beneficiary bank code
  recvAcctNo: string; // Beneficiary account number
  recvAcctHolder: string; // Payee name
  trAmt: string; // Transfer amount
  trStatus: string; // Transfer status ("S": success, "F": failed, "P": processing)
  trStatusNm: string; // Transfer status name
  memo: string; // Memo (transaction description)
}
```

---

## 5. Bank Code Table

### 5.1 Primary Financial Institutions

| Code | Bank Name                  | Code | Bank Name                        |
| ---- | -------------------------- | ---- | -------------------------------- |
| 002  | KDB Korea Development Bank | 003  | IBK Industrial Bank of Korea     |
| 004  | KB Kookmin Bank            | 007  | Sh Suhyup Bank                   |
| 011  | NH NongHyup Bank           | 012  | Local NongHyup cooperatives      |
| 020  | Woori Bank                 | 023  | SC First Bank                    |
| 027  | Citibank Korea             | 031  | iM Bank (formerly Daegu Bank)    |
| 032  | Busan Bank                 | 034  | Kwangju Bank                     |
| 035  | Jeju Bank                  | 037  | Jeonbuk Bank                     |
| 039  | Kyongnam Bank              | 045  | MG Community Credit Cooperatives |
| 048  | Shinhyup Credit Union      | 071  | Korea Post                       |
| 081  | Hana Bank                  | 088  | Shinhan Bank                     |

### 5.2 Internet-Only Banks

| Code | Bank Name |
| ---- | --------- |
| 089  | K Bank    |
| 090  | KakaoBank |
| 092  | Toss Bank |

### 5.3 TypeScript Constants

```typescript
// constants/bank-codes.ts
export const BANK_CODES = {
  // Primary financial institutions
  KDB: "002", // KDB Korea Development Bank
  IBK: "003", // IBK Industrial Bank of Korea
  KB: "004", // KB Kookmin Bank
  SUHYUP: "007", // Sh Suhyup Bank
  NH: "011", // NH NongHyup Bank
  LOCALNF: "012", // Local NongHyup cooperatives
  WOORI: "020", // Woori Bank
  SC: "023", // SC First Bank
  CITI: "027", // Citibank Korea
  DAEGU: "031", // iM Bank (formerly Daegu Bank)
  BUSAN: "032", // Busan Bank
  GWANGJU: "034", // Kwangju Bank
  JEJU: "035", // Jeju Bank
  JEONBUK: "037", // Jeonbuk Bank
  GYEONGNAM: "039", // Kyongnam Bank
  SAEMAUL: "045", // MG Community Credit Cooperatives
  SHINHYUP: "048", // Shinhyup Credit Union
  POST: "071", // Korea Post
  HANA: "081", // Hana Bank
  SHINHAN: "088", // Shinhan Bank
  // Internet-only banks
  KBANK: "089", // K Bank
  KAKAO: "090", // KakaoBank
  TOSS: "092", // Toss Bank
} as const;

export const BANK_NAMES: Record<string, string> = {
  "002": "KDB Korea Development Bank",
  "003": "IBK Industrial Bank of Korea",
  "004": "KB Kookmin Bank",
  "007": "Sh Suhyup Bank",
  "011": "NH NongHyup Bank",
  "012": "Local NongHyup cooperatives",
  "020": "Woori Bank",
  "023": "SC First Bank",
  "027": "Citibank Korea",
  "031": "iM Bank (formerly Daegu Bank)",
  "032": "Busan Bank",
  "034": "Kwangju Bank",
  "035": "Jeju Bank",
  "037": "Jeonbuk Bank",
  "039": "Kyongnam Bank",
  "045": "MG Community Credit Cooperatives",
  "048": "Shinhyup Credit Union",
  "071": "Korea Post",
  "081": "Hana Bank",
  "088": "Shinhan Bank",
  "089": "K Bank",
  "090": "KakaoBank",
  "092": "Toss Bank",
};
```

---

## 6. Use Cases

### 6.1 Automatic Collection of SaaS Payments

Automatically identifies and collects SaaS service payments from account transaction history.

```typescript
// lib/services/account-saas-detector.ts

// SaaS service pattern definitions
const SAAS_PATTERNS = [
  { pattern: /AWS|AMAZON WEB SERVICES/i, service: "AWS" },
  { pattern: /GOOGLE\s*(CLOUD|GCP)/i, service: "Google Cloud" },
  { pattern: /MICROSOFT|AZURE/i, service: "Microsoft Azure" },
  { pattern: /SLACK/i, service: "Slack" },
  { pattern: /NOTION/i, service: "Notion" },
  { pattern: /FIGMA/i, service: "Figma" },
  { pattern: /GITHUB/i, service: "GitHub" },
  { pattern: /ATLASSIAN|JIRA|CONFLUENCE/i, service: "Atlassian" },
  { pattern: /ZOOM/i, service: "Zoom" },
  { pattern: /DROPBOX/i, service: "Dropbox" },
  { pattern: /SALESFORCE/i, service: "Salesforce" },
  { pattern: /HUBSPOT/i, service: "HubSpot" },
  { pattern: /ZENDESK/i, service: "Zendesk" },
  { pattern: /INTERCOM/i, service: "Intercom" },
  { pattern: /DATADOG/i, service: "Datadog" },
  { pattern: /SENDGRID/i, service: "SendGrid" },
  { pattern: /TWILIO/i, service: "Twilio" },
  { pattern: /VERCEL/i, service: "Vercel" },
  { pattern: /NETLIFY/i, service: "Netlify" },
  { pattern: /HEROKU/i, service: "Heroku" },
];

interface DetectedSaaSPayment {
  transactionDate: string;
  transactionTime: string;
  serviceName: string;
  amount: number;
  originalTransactionName: string;
  memo: string;
}

export function detectSaaSPayments(
  transactions: TransactionItem[]
): DetectedSaaSPayment[] {
  const detected: DetectedSaaSPayment[] = [];

  for (const tr of transactions) {
    // Analyse withdrawals only
    if (tr.trType !== "O" || Number(tr.outAmt) === 0) continue;

    // Match SaaS patterns against the counterparty name or memo
    const searchText = `${tr.trNm} ${tr.memo}`;

    for (const { pattern, service } of SAAS_PATTERNS) {
      if (pattern.test(searchText)) {
        detected.push({
          transactionDate: tr.trDt,
          transactionTime: tr.trTm,
          serviceName: service,
          amount: Number(tr.outAmt),
          originalTransactionName: tr.trNm,
          memo: tr.memo,
        });
        break; // Use the first match only
      }
    }
  }

  return detected;
}

// Usage example
const transactions = await getTransactions(
  "004",
  "12345678901234",
  "20241101",
  "20241130",
  credential,
  { trType: "O" }
);

const saasPayments = detectSaaSPayments(transactions.data.list);
console.log(`SaaS payments found: ${saasPayments.length}`);
saasPayments.forEach((p) => {
  console.log(
    `- ${p.serviceName}: ${p.amount.toLocaleString()} KRW (${p.transactionDate})`
  );
});
```

### 6.2 Unified Management of Corporate Card and Bank Transfer Payments

Combines corporate card usage history and bank transfer history to manage total SaaS spend.

```typescript
// lib/services/unified-payment-tracker.ts

interface UnifiedPayment {
  date: string;
  serviceName: string;
  amount: number;
  paymentMethod: "CARD" | "TRANSFER";
  cardNo?: string;
  accountNo?: string;
  description: string;
}

interface PaymentSummary {
  totalAmount: number;
  cardAmount: number;
  transferAmount: number;
  byService: Record<string, number>;
  payments: UnifiedPayment[];
}

export async function getUnifiedPaymentSummary(
  organizationId: string,
  startDt: string,
  endDt: string
): Promise<PaymentSummary> {
  // 1. Retrieve corporate card usage history (see the Corporate Card Usage History guide)
  const cardPayments = await getCardSaaSPayments(
    organizationId,
    startDt,
    endDt
  );

  // 2. Retrieve bank transfer history
  const accountPayments = await getAccountSaaSPayments(
    organizationId,
    startDt,
    endDt
  );

  // 3. Consolidate
  const payments: UnifiedPayment[] = [
    ...cardPayments.map((p) => ({
      date: p.approvalDate,
      serviceName: p.serviceName,
      amount: p.amount,
      paymentMethod: "CARD" as const,
      cardNo: p.cardNo,
      description: p.merchantName,
    })),
    ...accountPayments.map((p) => ({
      date: p.transactionDate,
      serviceName: p.serviceName,
      amount: p.amount,
      paymentMethod: "TRANSFER" as const,
      accountNo: p.accountNo,
      description: p.originalTransactionName,
    })),
  ];

  // 4. Aggregate
  const byService: Record<string, number> = {};
  let cardAmount = 0;
  let transferAmount = 0;

  for (const p of payments) {
    byService[p.serviceName] = (byService[p.serviceName] || 0) + p.amount;
    if (p.paymentMethod === "CARD") {
      cardAmount += p.amount;
    } else {
      transferAmount += p.amount;
    }
  }

  return {
    totalAmount: cardAmount + transferAmount,
    cardAmount,
    transferAmount,
    byService,
    payments: payments.sort((a, b) => b.date.localeCompare(a.date)),
  };
}
```

### 6.3 Cash Flow Monitoring

Monitors real-time account balances and daily deposit/withdrawal trends.

```typescript
// lib/services/cashflow-monitor.ts

interface DailyCashflow {
  date: string;
  inflow: number; // Total deposits
  outflow: number; // Total withdrawals
  netflow: number; // Net inflow (deposits - withdrawals)
  balance: number; // Balance
}

interface CashflowReport {
  period: { start: string; end: string };
  accounts: AccountCashflow[];
  totalBalance: number;
  totalInflow: number;
  totalOutflow: number;
  dailyTrend: DailyCashflow[];
}

interface AccountCashflow {
  bankCd: string;
  bankNm: string;
  acctNo: string;
  acctNm: string;
  currentBalance: number;
  periodInflow: number;
  periodOutflow: number;
}

export async function generateCashflowReport(
  organizationId: string,
  startDt: string,
  endDt: string
): Promise<CashflowReport> {
  // Retrieve all accounts registered to the organisation
  const registeredAccounts = await getRegisteredAccounts(organizationId);

  const accounts: AccountCashflow[] = [];
  const dailyMap = new Map<string, DailyCashflow>();
  let totalBalance = 0;
  let totalInflow = 0;
  let totalOutflow = 0;

  for (const account of registeredAccounts) {
    // Balance inquiry
    const balance = await getAccountBalance(
      account.bankCd,
      account.acctNo,
      account.credential
    );

    // Transaction history inquiry
    const transactions = await getTransactions(
      account.bankCd,
      account.acctNo,
      startDt,
      endDt,
      account.credential
    );

    let periodInflow = 0;
    let periodOutflow = 0;

    for (const tr of transactions.data.list) {
      const inAmt = Number(tr.inAmt) || 0;
      const outAmt = Number(tr.outAmt) || 0;

      periodInflow += inAmt;
      periodOutflow += outAmt;

      // Daily aggregation
      const daily = dailyMap.get(tr.trDt) || {
        date: tr.trDt,
        inflow: 0,
        outflow: 0,
        netflow: 0,
        balance: 0,
      };
      daily.inflow += inAmt;
      daily.outflow += outAmt;
      daily.netflow = daily.inflow - daily.outflow;
      dailyMap.set(tr.trDt, daily);
    }

    const currentBalance = Number(balance.data.balance);
    accounts.push({
      bankCd: account.bankCd,
      bankNm: BANK_NAMES[account.bankCd],
      acctNo: account.acctNo,
      acctNm: balance.data.acctNm,
      currentBalance,
      periodInflow,
      periodOutflow,
    });

    totalBalance += currentBalance;
    totalInflow += periodInflow;
    totalOutflow += periodOutflow;
  }

  // Sort the daily trend
  const dailyTrend = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return {
    period: { start: startDt, end: endDt },
    accounts,
    totalBalance,
    totalInflow,
    totalOutflow,
    dailyTrend,
  };
}
```

### 6.4 Server Action Example

Implements the transaction history inquiry as a Next.js Server Action.

```typescript
// actions/account.ts
"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

const transactionQuerySchema = z.object({
  accountId: z.string(),
  startDate: z.string().regex(/^\d{8}$/),
  endDate: z.string().regex(/^\d{8}$/),
  transactionType: z.enum(["A", "I", "O"]).default("A"),
});

interface TransactionQueryResult {
  success: boolean;
  data?: {
    transactions: TransactionItem[];
    totalCount: number;
    summary: {
      totalInflow: number;
      totalOutflow: number;
      netflow: number;
    };
  };
  error?: string;
}

export async function queryAccountTransactions(
  input: z.infer<typeof transactionQuerySchema>
): Promise<TransactionQueryResult> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication is required" };
    }

    const validated = transactionQuerySchema.parse(input);

    // Retrieve account details (confirm it belongs to the organisation)
    const account = await prisma.bankAccount.findFirst({
      where: {
        id: validated.accountId,
        organizationId: session.user.organizationId,
      },
    });

    if (!account) {
      return { success: false, error: "Account not found" };
    }

    // Decrypt the bank credentials
    const credential = await decryptCredential(account.encryptedCredential);

    // Call the Hyphen API
    const response = await getTransactions(
      account.bankCd,
      account.acctNo,
      validated.startDate,
      validated.endDate,
      credential,
      { trType: validated.transactionType }
    );

    if (response.code !== "00000") {
      return { success: false, error: response.message };
    }

    // Calculate totals
    let totalInflow = 0;
    let totalOutflow = 0;

    for (const tr of response.data.list) {
      totalInflow += Number(tr.inAmt) || 0;
      totalOutflow += Number(tr.outAmt) || 0;
    }

    return {
      success: true,
      data: {
        transactions: response.data.list,
        totalCount: Number(response.data.totalCount),
        summary: {
          totalInflow,
          totalOutflow,
          netflow: totalInflow - totalOutflow,
        },
      },
    };
  } catch (error) {
    console.error("Account transaction history inquiry failed:", error);
    return { success: false, error: "Failed to retrieve transaction history" };
  }
}
```

---

## 7. Error Handling and Considerations

### 7.1 Common Error Codes

| Code  | Description                | Resolution                                  |
| ----- | -------------------------- | ------------------------------------------- |
| 00000 | Success                    | -                                           |
| 10001 | Authentication failed      | Re-issue the access token                   |
| 10002 | Not authorised             | Confirm the product application             |
| 20001 | Required parameter missing | Check the request parameters                |
| 20002 | Invalid parameter format   | Check the date / account number format      |
| 30001 | Bank login failed          | Check the ID/password or certificate        |
| 30002 | Account inquiry failed     | Check the account number                    |
| 30003 | Query period exceeded      | Shorten the query period (maximum 3 months) |
| 40001 | System error               | Retry after a short while                   |
| 40002 | Bank under maintenance     | Check the bank's maintenance window         |

### 7.2 Query Limits by Bank

| Bank       | Maximum Query Period | Daily Query Limit | Notes                  |
| ---------- | -------------------- | ----------------- | ---------------------- |
| Most banks | 3 months             | Unlimited         | -                      |
| Some banks | 1 month              | -                 | Split queries required |

### 7.3 Error Handling Example

```typescript
// lib/hyphen-error-handler.ts

class HyphenApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public isRetryable: boolean = false
  ) {
    super(message);
    this.name = "HyphenApiError";
  }
}

const RETRYABLE_ERRORS = ["40001", "40002"];

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();

      // Check the response code
      if (typeof result === "object" && result !== null && "code" in result) {
        const response = result as { code: string; message: string };

        if (response.code !== "00000") {
          const isRetryable = RETRYABLE_ERRORS.includes(response.code);

          if (isRetryable && attempt < maxRetries) {
            await delay(delayMs * attempt); // Exponential backoff
            continue;
          }

          throw new HyphenApiError(
            response.code,
            response.message,
            isRetryable
          );
        }
      }

      return result;
    } catch (error) {
      lastError = error as Error;

      if (error instanceof HyphenApiError && !error.isRetryable) {
        throw error;
      }

      if (attempt < maxRetries) {
        await delay(delayMs * attempt);
      }
    }
  }

  throw lastError || new Error("Unknown error");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Usage example
const result = await withRetry(
  () => getTransactions(bankCd, acctNo, startDt, endDt, credential),
  3,
  2000
);
```

### 7.4 Security Considerations

```typescript
// ⚠️ Security checklist

// 1. Store credentials encrypted
// ❌ Never store in plain text
const credential = { userId: "user", userPw: "password" }; // Strictly prohibited

// ✅ Store encrypted
const encryptedCredential = await encrypt(JSON.stringify(credential));
await prisma.bankAccount.create({
  data: {
    bankCd,
    acctNo,
    encryptedCredential, // Encrypted with AES-256-GCM or similar
    organizationId,
  },
});

// 2. Manage keys via environment variables
// .env.local
HYPHEN_USER_ID = your_user_id;
HYPHEN_HKEY = your_hkey;
ENCRYPTION_KEY = your_32_byte_key;

// 3. Mask sensitive information when logging
function maskAccountNo(acctNo: string): string {
  if (acctNo.length <= 4) return "****";
  return acctNo.slice(0, 4) + "*".repeat(acctNo.length - 4);
}

console.log(`Account inquiry: ${maskAccountNo("1234567890")}`); // "1234******"

// 4. Verify access permissions
async function queryTransactions(accountId: string, userId: string) {
  const account = await prisma.bankAccount.findFirst({
    where: {
      id: accountId,
      organization: {
        members: {
          some: { userId, role: { in: ["ADMIN", "MEMBER"] } },
        },
      },
    },
  });

  if (!account) {
    throw new Error("You do not have permission to access this account");
  }
  // ...
}
```

### 7.5 Performance Optimisation

```typescript
// 1. Split the query period (for long date ranges)
async function getTransactionsInChunks(
  bankCd: string,
  acctNo: string,
  startDt: string,
  endDt: string,
  credential: Credential,
  chunkDays: number = 30
): Promise<TransactionItem[]> {
  const chunks = splitDateRange(startDt, endDt, chunkDays);
  const allTransactions: TransactionItem[] = [];

  for (const { start, end } of chunks) {
    const response = await getTransactions(
      bankCd,
      acctNo,
      start,
      end,
      credential
    );
    allTransactions.push(...response.data.list);

    // Rate limiting
    await delay(500);
  }

  return allTransactions;
}

// 2. Caching (frequently queried balance information)
import { unstable_cache } from "next/cache";

const getCachedBalance = unstable_cache(
  async (bankCd: string, acctNo: string) => {
    return getAccountBalance(bankCd, acctNo, credential);
  },
  ["account-balance"],
  { revalidate: 300 } // 5-minute cache
);

// 3. Parallel queries (query multiple accounts concurrently)
async function getAllAccountBalances(
  accounts: Account[]
): Promise<BalanceResponse[]> {
  return Promise.all(
    accounts.map((account) =>
      getAccountBalance(account.bankCd, account.acctNo, account.credential)
    )
  );
}
```

---

## Related Documents

- Corporate Card Usage History Guide (not included in this repository)
- [Bank Account Verification (1-Won Verification) Guide](./bank-account-verification.md)
- [Hyphen API Official Documentation](https://hyphen.im/product-api/view?seq=54)
