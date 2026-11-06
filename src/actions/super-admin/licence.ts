// src/actions/super-admin/licence.ts
"use server";

/**
 * Control Panel — read-only licence view. Limits are read through the
 * `LicenseProvider` (`@/lib/licensing`); the HelloPixels licensing application
 * will manage them later. Nothing here changes a licence.
 */
import { prisma } from "@/lib/db";
import { getDeploymentInfo, type DeploymentInfo } from "@/lib/deployment/mode";
import {
  getInstallationId,
  getLicense,
  getLicenseProvider,
  isLicenseExpired,
  type License,
} from "@/lib/licensing";
import type { ActionState } from "@/types";
import { platformAction } from "./_action";

export interface LicenceOverview {
  license: License;
  expired: boolean;
  providerId: string;
  installationId: string;
  deployment: DeploymentInfo;
  usage: { tenants: number; largestTenantUsers: number };
}

async function largestTenantUsers(): Promise<number> {
  const rows = await prisma.user.groupBy({
    by: ["organizationId"],
    where: { organizationId: { not: null }, organization: { deletedAt: null } },
    _count: { _all: true },
  });
  return rows.reduce((max, r) => Math.max(max, r._count._all), 0);
}

async function _getLicenceOverview(): Promise<ActionState<LicenceOverview>> {
  const [license, installationId, tenants, largest] = await Promise.all([
    getLicense(),
    getInstallationId(),
    prisma.organization.count({ where: { deletedAt: null } }),
    largestTenantUsers(),
  ]);
  return {
    success: true,
    data: {
      license,
      expired: isLicenseExpired(license),
      providerId: getLicenseProvider().id,
      installationId,
      deployment: getDeploymentInfo(),
      usage: { tenants, largestTenantUsers: largest },
    },
  };
}

export const getLicenceOverview = platformAction(
  "getLicenceOverview",
  _getLicenceOverview
);
