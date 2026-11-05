// src/lib/services/discovery/types.ts
/**
 * App activity detection — type definitions
 * Interfaces for future IdP API integrations (Okta, Azure AD, etc.)
 */

/**
 * App access discovered from an IdP
 */
export interface IdPAppAccess {
  /** App identifier used by the IdP */
  externalAppId: string;
  /** App name in the IdP */
  appName: string;
  /** E-mail of the user who accessed the app */
  userEmail: string;
  /** Last used at */
  lastUsedAt: Date;
  /** Access status (active/revoked) */
  status: "active" | "revoked";
}

/**
 * IdP provider adapter interface
 *
 * Planned implementations:
 * - OktaAdapter: AccessSource.IDP_OKTA
 * - AzureADAdapter: AccessSource.IDP_AZURE_AD
 * - OneLoginAdapter: AccessSource.IDP_ONELOGIN
 *
 * AccessSource enum extensions (to be added):
 * - IDP_OKTA
 * - IDP_AZURE_AD
 * - IDP_ONELOGIN
 */
export interface IdPProviderAdapter {
  /** Provider name (e.g. "okta", "azure_ad") */
  readonly providerName: string;

  /**
   * Fetches the organization's app access list from the IdP
   * @param credentials - IdP API credentials
   * @param organizationId - Organization ID
   * @returns Array of app access records
   */
  fetchAppAccesses(
    credentials: Record<string, string>,
    organizationId: string
  ): Promise<IdPAppAccess[]>;

  /**
   * Checks the IdP connection
   * @param credentials - IdP API credentials
   * @returns Whether the connection succeeds
   */
  testConnection(credentials: Record<string, string>): Promise<boolean>;
}
