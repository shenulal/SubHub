// src/actions/platform/masters/countries.ts
"use server";

/**
 * Country master — a platform-wide table (no organisationId). Everyone with
 * `masters:read` may list it; create / edit / (de)activate needs
 * `masters:manage_global` (platform-only in SaaS mode — the super-admin console).
 * Changes are audited against the caller's organisation, or in the platform audit
 * log when a SUPER_ADMIN acts from the console.
 */
import {
  ActionError,
  diffRecords,
  toActionError,
} from "@/actions/platform/_shared";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { auditPlatformChange } from "@/lib/platform-audit";
import { requirePlatformActor } from "@/lib/rbac/service";
import { getSettings, getSystemSetting } from "@/lib/settings/service";
import {
  countryInputSchema,
  masterActiveSchema,
  type CountryInput,
} from "@/lib/validations/platform";
import type { ActionState } from "@/types";
import type { CountryRow } from "@/types/platform";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { queryCountries } from "./queries";

const MASTERS_PATH = "/settings/masters";
const PLATFORM_MASTERS_PATH = "/super-admin/masters";

function revalidateMasters() {
  revalidatePath(MASTERS_PATH);
  revalidatePath(PLATFORM_MASTERS_PATH);
}

function countryData(input: CountryInput) {
  return {
    name: input.name,
    region: input.region || null,
    currencyCode: input.currencyCode ?? null,
    defaultTaxRatePercent: input.defaultTaxRatePercent ?? null,
    phonePrefix: input.phonePrefix ?? null,
    isActive: input.isActive,
  };
}

async function assertCurrencyExists(code: string | null): Promise<void> {
  if (!code) return;
  const currency = await prisma.currency.findUnique({ where: { code } });
  if (!currency) {
    throw new ActionError(`Currency ${code} is not in the currency master`);
  }
}

/** The caller's organisation country (or the platform default) stays active. */
async function assertNotOrganizationCountry(
  organizationId: string | null,
  code: string
): Promise<void> {
  const current = organizationId
    ? (await getSettings(organizationId, ["general.countryCode"]))[
        "general.countryCode"
      ]
    : await getSystemSetting("general.countryCode");
  if (current === code) {
    throw new ActionError(
      organizationId
        ? "Your organisation's country cannot be deactivated"
        : "The platform default country cannot be deactivated"
    );
  }
}

async function _listCountries(
  options: { includeInactive?: boolean } = {}
): Promise<ActionState<CountryRow[]>> {
  try {
    await requirePlatformActor("masters:read");
    return {
      success: true,
      data: await queryCountries({
        includeInactive: Boolean(options.includeInactive),
      }),
    };
  } catch (error) {
    return toActionError(error, "listCountries");
  }
}
export const listCountries = withLogging("listCountries", _listCountries);

async function _createCountry(
  raw: unknown
): Promise<ActionState<{ code: string }>> {
  try {
    const actor = await requirePlatformActor("masters:manage_global");
    const input = countryInputSchema.parse(raw);
    const existing = await prisma.country.findUnique({
      where: { code: input.code },
    });
    if (existing) throw new ActionError(`Country ${input.code} already exists`);
    await assertCurrencyExists(input.currencyCode ?? null);
    const data = countryData(input);
    await prisma.country.create({ data: { code: input.code, ...data } });
    await auditPlatformChange(actor, {
      action: "CREATE_COUNTRY",
      entityType: "Country",
      entityId: input.code,
      changes: { to: data },
    });
    revalidateMasters();
    return { success: true, data: { code: input.code } };
  } catch (error) {
    return toActionError(error, "createCountry");
  }
}
export const createCountry = withLogging("createCountry", _createCountry);

async function _updateCountry(
  code: string,
  raw: unknown
): Promise<ActionState> {
  try {
    const actor = await requirePlatformActor("masters:manage_global");
    const { organizationId } = actor;
    const input = countryInputSchema.parse({
      ...(raw as Record<string, unknown>),
      code,
    });
    const existing = await prisma.country.findUnique({
      where: { code: input.code },
    });
    if (!existing) throw new ActionError("Country not found");
    await assertCurrencyExists(input.currencyCode ?? null);
    if (!input.isActive)
      await assertNotOrganizationCountry(organizationId, code);
    const data = countryData(input);
    await prisma.country.update({ where: { code: input.code }, data });
    await auditPlatformChange(actor, {
      action: "UPDATE_COUNTRY",
      entityType: "Country",
      entityId: input.code,
      changes: diffRecords(
        {
          name: existing.name,
          region: existing.region,
          currencyCode: existing.currencyCode,
          defaultTaxRatePercent:
            existing.defaultTaxRatePercent === null
              ? null
              : Number(existing.defaultTaxRatePercent),
          phonePrefix: existing.phonePrefix,
          isActive: existing.isActive,
        },
        data
      ) as Prisma.InputJsonValue,
    });
    revalidateMasters();
    return { success: true };
  } catch (error) {
    return toActionError(error, "updateCountry");
  }
}
export const updateCountry = withLogging("updateCountry", _updateCountry);

async function _setCountryActive(raw: unknown): Promise<ActionState> {
  try {
    const actor = await requirePlatformActor("masters:manage_global");
    const { organizationId } = actor;
    const { code, isActive } = masterActiveSchema.parse(raw);
    const existing = await prisma.country.findUnique({ where: { code } });
    if (!existing) throw new ActionError("Country not found");
    if (!isActive) await assertNotOrganizationCountry(organizationId, code);
    await prisma.country.update({ where: { code }, data: { isActive } });
    await auditPlatformChange(actor, {
      action: isActive ? "ACTIVATE_COUNTRY" : "DEACTIVATE_COUNTRY",
      entityType: "Country",
      entityId: code,
      changes: { isActive: { from: existing.isActive, to: isActive } },
    });
    revalidateMasters();
    return { success: true };
  } catch (error) {
    return toActionError(error, "setCountryActive");
  }
}
export const setCountryActive = withLogging(
  "setCountryActive",
  _setCountryActive
);
