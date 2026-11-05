// src/lib/services/erp/types.ts
// Shared types for ERP integration adapters

import type { IntegrationType } from "@prisma/client";

/** Payment/expense item from the ERP (normalised) */
export interface ERPPaymentItem {
  transactionDate: Date;
  merchantName: string;
  amount: number;
  currency: string;
  category?: string;
  memo?: string;
  /** ERP internal document number (for deduplication) */
  documentNumber?: string;
  /** Raw data */
  rawData: Record<string, unknown>;
}

/** ERP sync result */
export interface ERPSyncResult {
  success: boolean;
  items: ERPPaymentItem[];
  totalCount: number;
  errorMessage?: string;
}

/** ERP sync request parameters */
export interface ERPSyncRequest {
  /** Query start date */
  fromDate: Date;
  /** Query end date */
  toDate: Date;
  /** Company code (SAP) / Business Unit (Oracle) */
  companyCode?: string;
  /** Maximum number of records */
  maxItems?: number;
}

/** SAP S/4HANA credentials */
export interface SapCredentials {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  username?: string;
  password?: string;
  companyCode?: string;
}

/** Oracle ERP Cloud credentials */
export interface OracleCredentials {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
  businessUnit?: string;
}

/** Unified ERP credentials type */
export type ERPCredentials = SapCredentials | OracleCredentials;

/** ERP payment adapter interface */
export interface ERPPaymentAdapter {
  /** IntegrationType supported by the adapter */
  readonly type: IntegrationType;
  /** Adapter display name */
  readonly name: string;
  /** Connection test */
  testConnection(credentials: ERPCredentials): Promise<boolean>;
  /** Fetches payment/expense data */
  fetchPayments(
    credentials: ERPCredentials,
    request: ERPSyncRequest
  ): Promise<ERPSyncResult>;
}
