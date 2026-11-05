// src/lib/deployment/mode.ts
/**
 * Deployment mode — one environment variable decides how SubHub is tenanted.
 *
 *   SUBHUB_DEPLOYMENT_MODE=single-tenant (default; aliases: on-premise, self-hosted)
 *     One organisation per installation (customer self-hosting / on-premise).
 *   SUBHUB_DEPLOYMENT_MODE=saas
 *     Multi-tenant cloud; many organisations isolated by organizationId.
 *
 * This module has no server-only imports: the types, labels and parser are safe in
 * client bundles. On the client the env variable is NOT available (it is not
 * NEXT_PUBLIC_), so client code must read the mode from `/api/v1/system/info`
 * (`useDeploymentInfo`) or from props passed by a server component.
 */

export const DEPLOYMENT_MODE_ENV = "SUBHUB_DEPLOYMENT_MODE";

export const DEPLOYMENT_MODES = ["single-tenant", "saas"] as const;
export type DeploymentMode = (typeof DEPLOYMENT_MODES)[number];

export const DEFAULT_DEPLOYMENT_MODE: DeploymentMode = "single-tenant";

/** Accepted spellings (case-insensitive, surrounding whitespace ignored). */
const MODE_ALIASES: Readonly<Record<string, DeploymentMode>> = {
  "single-tenant": "single-tenant",
  "on-premise": "single-tenant",
  "self-hosted": "single-tenant",
  saas: "saas",
};

export const DEPLOYMENT_MODE_LABELS: Readonly<Record<DeploymentMode, string>> =
  {
    "single-tenant": "On-premise / self-hosted (single tenant)",
    saas: "SaaS (multi-tenant)",
  };

export interface DeploymentInfo {
  mode: DeploymentMode;
  label: string;
  multiTenant: boolean;
}

export class DeploymentModeError extends Error {
  constructor(public readonly value: string) {
    super(
      `Invalid ${DEPLOYMENT_MODE_ENV}="${value}". Use one of: ${Object.keys(
        MODE_ALIASES
      ).join(", ")} (default: ${DEFAULT_DEPLOYMENT_MODE}).`
    );
    this.name = "DeploymentModeError";
  }
}

/**
 * Parse a raw env value. Empty / unset → default; unknown → DeploymentModeError.
 */
export function parseDeploymentMode(raw: string | undefined): DeploymentMode {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "") return DEFAULT_DEPLOYMENT_MODE;
  const mode = MODE_ALIASES[value];
  if (!mode) throw new DeploymentModeError(raw ?? "");
  return mode;
}

/** Server-side: the configured mode (throws on an invalid value — fail closed). */
export function getDeploymentMode(): DeploymentMode {
  return parseDeploymentMode(process.env[DEPLOYMENT_MODE_ENV]);
}

export function isSingleTenant(): boolean {
  return getDeploymentMode() === "single-tenant";
}

export function isSaas(): boolean {
  return getDeploymentMode() === "saas";
}

export function getDeploymentModeLabel(mode: DeploymentMode): string {
  return DEPLOYMENT_MODE_LABELS[mode];
}

export function toDeploymentInfo(mode: DeploymentMode): DeploymentInfo {
  return {
    mode,
    label: getDeploymentModeLabel(mode),
    multiTenant: mode === "saas",
  };
}

/** Server-side: serialisable mode description for props and `/api/v1/system/info`. */
export function getDeploymentInfo(): DeploymentInfo {
  return toDeploymentInfo(getDeploymentMode());
}

/**
 * Startup check (called from `instrumentation.ts#register`): an unknown value stops
 * the server with a clear message instead of silently falling back to a mode.
 */
export function assertDeploymentModeConfigured(): DeploymentMode {
  return getDeploymentMode();
}
