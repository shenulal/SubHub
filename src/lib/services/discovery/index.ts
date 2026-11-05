// src/lib/services/discovery/index.ts
/**
 * App discovery service module exports
 */

export { discoverAppsFromGoogle, processDiscoveredApps } from "./appDiscovery";
export { matchDomainToApp } from "./domain-matcher";
export type { DomainMatchResult } from "./domain-matcher";
export { bridgeLoginToAppAccess } from "./login-access-bridge";
export type { BridgeLoginParams, BridgeResult } from "./login-access-bridge";
export type { IdPAppAccess, IdPProviderAdapter } from "./types";
