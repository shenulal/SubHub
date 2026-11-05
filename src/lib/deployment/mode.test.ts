// src/lib/deployment/mode.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertDeploymentModeConfigured,
  DEFAULT_DEPLOYMENT_MODE,
  DeploymentModeError,
  getDeploymentInfo,
  getDeploymentMode,
  getDeploymentModeLabel,
  isSaas,
  isSingleTenant,
  parseDeploymentMode,
} from "./mode";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseDeploymentMode", () => {
  it("defaults to single-tenant when unset or blank", () => {
    expect(DEFAULT_DEPLOYMENT_MODE).toBe("single-tenant");
    expect(parseDeploymentMode(undefined)).toBe("single-tenant");
    expect(parseDeploymentMode("")).toBe("single-tenant");
    expect(parseDeploymentMode("   ")).toBe("single-tenant");
  });

  it.each([
    ["single-tenant", "single-tenant"],
    ["on-premise", "single-tenant"],
    ["self-hosted", "single-tenant"],
    ["SELF-HOSTED", "single-tenant"],
    [" On-Premise ", "single-tenant"],
    ["saas", "saas"],
    ["SaaS", "saas"],
  ])("maps %s to %s", (raw, expected) => {
    expect(parseDeploymentMode(raw)).toBe(expected);
  });

  it("rejects an unknown value with a message naming the variable and options", () => {
    expect(() => parseDeploymentMode("multi")).toThrow(DeploymentModeError);
    expect(() => parseDeploymentMode("multi")).toThrow(
      /SUBHUB_DEPLOYMENT_MODE="multi".*single-tenant.*on-premise.*self-hosted.*saas/
    );
  });
});

describe("environment helpers", () => {
  it("reads single-tenant by default", () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "");
    expect(getDeploymentMode()).toBe("single-tenant");
    expect(isSingleTenant()).toBe(true);
    expect(isSaas()).toBe(false);
    expect(getDeploymentInfo()).toEqual({
      mode: "single-tenant",
      label: "On-premise / self-hosted (single tenant)",
      multiTenant: false,
    });
  });

  it("reads saas", () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "saas");
    expect(isSaas()).toBe(true);
    expect(isSingleTenant()).toBe(false);
    expect(getDeploymentInfo()).toEqual({
      mode: "saas",
      label: "SaaS (multi-tenant)",
      multiTenant: true,
    });
  });

  it("fails fast at startup on an invalid value", () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "hybrid");
    expect(() => assertDeploymentModeConfigured()).toThrow(DeploymentModeError);
    expect(() => isSaas()).toThrow(DeploymentModeError);
  });

  it("labels each mode", () => {
    expect(getDeploymentModeLabel("saas")).toBe("SaaS (multi-tenant)");
    expect(getDeploymentModeLabel("single-tenant")).toBe(
      "On-premise / self-hosted (single tenant)"
    );
  });
});
