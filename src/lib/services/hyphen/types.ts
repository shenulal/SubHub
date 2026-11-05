/**
 * Korean financial API integration types — Hyphen service (Korean corporate card/banking data aggregator).
 * This module integrates with Korean banking APIs. For other markets, provide an alternative adapter.
 */

/**
 * Hyphen API type definitions
 * Based on the corporate card inquiry API (seq=55)
 */

// ==================== Common types ====================

/** Hyphen API common response */
export interface HyphenCommonResponse {
  userTrNo?: string;
  hyphenTrNo?: string;
  errYn: "Y" | "N";
  errCd?: string;
  errMsg?: string;
}

/** Hyphen API response wrapper */
export interface HyphenApiResponse<T> {
  common: HyphenCommonResponse;
  data: T;
}

/** Login method */
export type LoginMethod = "ID" | "CERT";

/** Card company code */
export type CardCompanyCode =
  | "001" // Shinhan Card
  | "002" // Hyundai Card
  | "003" // Samsung Card
  | "004" // KB Kookmin Card
  | "005" // Lotte Card
  | "006" // Hana Card
  | "007" // Woori Card
  | "008" // NH Nonghyup Card
  | "009" // Citi Card
  | "010" // BC Card
  | "011" // Suhyup Card
  | "012" // Kwangju Bank Card
  | "013" // Jeonbuk Bank Card
  | "014"; // Jeju Bank Card

/** Card company display names */
export const CARD_COMPANIES: Record<CardCompanyCode, string> = {
  "001": "Shinhan Card",
  "002": "Hyundai Card",
  "003": "Samsung Card",
  "004": "KB Kookmin Card",
  "005": "Lotte Card",
  "006": "Hana Card",
  "007": "Woori Card",
  "008": "NH Nonghyup Card",
  "009": "Citi Card",
  "010": "BC Card",
  "011": "Suhyup Card",
  "012": "Kwangju Bank Card",
  "013": "Jeonbuk Bank Card",
  "014": "Jeju Bank Card",
};

// ==================== Credential types ====================

/** ID login credentials */
export interface IdLoginCredentials {
  loginMethod: "ID";
  cardNo: string; // Original card number (stored encrypted)
  userId: string;
  userPw: string;
  bizNo?: string;
  userIdx?: string; // For Lotte Card
}

/** Certificate login credentials */
export interface CertLoginCredentials {
  loginMethod: "CERT";
  cardNo: string; // Original card number (stored encrypted)
  signCert: string;
  signPri: string;
  signPw: string;
  bizNo?: string;
  userIdx?: string; // For Lotte Card
}

/** Card company credentials */
export type CardCredentials = IdLoginCredentials | CertLoginCredentials;

// ==================== Approval history inquiry ====================

/** Approval history request */
export interface ApprovalRequest {
  cardCd: CardCompanyCode;
  cardNo: string;
  sdate: string; // YYYYMMDD
  edate: string; // YYYYMMDD
  useArea?: "D" | "G" | "N"; // D: domestic, G: overseas, N: all
  svcOption?: "storeDetail"; // Merchant details
  viewMethod?: "standard" | "define"; // For BC Card
  cardNoFilter?: "Y" | "N";
}

/** Approval history item */
export interface ApprovalItem {
  useDt: string; // Transaction date (YYYYMMDD)
  useTm: string; // Transaction time (HHmmss)
  apprNo: string; // Approval number
  useCard: string; // Card name used
  useStore: string; // Merchant name
  useAmt: string; // Amount
  useExAmt?: string; // Overseas amount
  exCurCd?: string; // Overseas currency code
  useDiv: string; // Transaction type (Korean API values: approval / cancellation)
  apprSt?: string; // Approval status
  instMon?: string; // Instalment months
  discAmt?: string; // Discount amount
  savePoint?: string; // Reward points
  settleDt?: string; // Scheduled settlement date
  storeBizNo?: string; // Merchant business registration number
  storeCeo?: string; // Merchant owner
  storeAddr?: string; // Merchant address
  storeTel?: string; // Merchant phone number
  storeType?: string; // Merchant business type
  addTax?: string; // VAT
  tip?: string; // Service charge
  taxType?: string; // Tax type
  storeSt?: string; // Merchant status
  storeNo?: string; // Merchant number
  givenCardNo?: string; // Assigned card number
}

/** Approval history response data */
export interface ApprovalData {
  totalAmt?: string;
  totalCnt?: string;
  list: ApprovalItem[];
}

/** Approval history response */
export type ApprovalResponse = HyphenApiResponse<ApprovalData>;

// ==================== Purchase (settlement) history inquiry ====================

/** Purchase history request */
export interface PurchaseRequest {
  cardCd: CardCompanyCode;
  cardNo: string;
  sdate: string; // YYYYMMDD
  edate: string; // YYYYMMDD
  useArea?: "D" | "G" | "N";
  svcOption?: "storeDetail";
  viewMethod?: "standard" | "define";
  cardNoFilter?: "Y" | "N";
}

/** Purchase history item */
export interface PurchaseItem extends ApprovalItem {
  pchDt?: string; // Purchase date
  pchNo?: string; // Purchase number
  virtualYn?: string; // Virtual card flag
  exYn?: string; // Overseas usage flag
}

/** Purchase history response data */
export interface PurchaseData {
  totalAmt?: string;
  totalCnt?: string;
  list: PurchaseItem[];
}

/** Purchase history response */
export type PurchaseResponse = HyphenApiResponse<PurchaseData>;

// ==================== OAuth token ====================

/** OAuth token response */
export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

// ==================== Error types ====================

/** Hyphen API error */
export class HyphenApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public response?: HyphenCommonResponse
  ) {
    super(message);
    this.name = "HyphenApiError";
  }
}
