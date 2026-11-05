// src/lib/services/erp/index.ts
// ERP adapter registry + factory

import type { IntegrationType } from "@prisma/client";
import { oracleAdapter } from "./oracle";
import { sapAdapter } from "./sap";
import type { ERPPaymentAdapter } from "./types";

export type {
  ERPCredentials,
  ERPPaymentAdapter,
  ERPPaymentItem,
  ERPSyncRequest,
  ERPSyncResult,
  OracleCredentials,
  SapCredentials,
} from "./types";

const ADAPTER_REGISTRY: Map<IntegrationType, ERPPaymentAdapter> = new Map([
  ["SAP_S4HANA", sapAdapter],
  ["ORACLE_ERP_CLOUD", oracleAdapter],
]);

/** Returns the ERP adapter for an IntegrationType */
export function getERPAdapter(
  type: IntegrationType
): ERPPaymentAdapter | undefined {
  return ADAPTER_REGISTRY.get(type);
}

/** Checks whether the type is an ERP type */
export function isERPIntegrationType(type: IntegrationType): boolean {
  return ADAPTER_REGISTRY.has(type);
}

/** Returns all registered ERP adapters */
export function getAllERPAdapters(): ERPPaymentAdapter[] {
  return Array.from(ADAPTER_REGISTRY.values());
}
