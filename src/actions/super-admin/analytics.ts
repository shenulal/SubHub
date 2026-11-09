// src/actions/super-admin/analytics.ts
"use server";

/**
 * Control Panel analytics (read-only): platform-wide figures across every
 * organisation, or one organisation's figures. Only aggregates leave the
 * server. Money is converted with `@/lib/fx` — platform view into the platform
 * reporting currency (`system.reportingCurrency`), organisation view into that
 * organisation's `finance.baseCurrency`.
 */
import { logger } from "@/lib/logger";
import { buildOrganizationAnalytics } from "@/lib/services/platform-analytics/organization";
import { buildPlatformAnalytics } from "@/lib/services/platform-analytics/platform";
import { loadAnalyticsSettings } from "@/lib/services/platform-analytics/settings";
import type { ActionState } from "@/types";
import type {
  OrganizationAnalytics,
  PlatformAnalytics,
} from "@/types/platform-analytics";
import { z } from "zod";

import { platformAction } from "./_action";
import { NO_TENANT_MESSAGE, resolveConsoleTenant } from "./_tenant";

const LOAD_FAILED = "Could not load analytics.";
const MAX_PERIOD_TOKEN = 8;
const MAX_ID_LENGTH = 64;

const periodSchema = z
  .string()
  .trim()
  .max(MAX_PERIOD_TOKEN)
  .nullish()
  .catch(undefined);

const platformInputSchema = z
  .object({ period: periodSchema })
  .optional()
  .default({});

const organizationInputSchema = z
  .object({
    organizationId: z.string().trim().min(1).max(MAX_ID_LENGTH).nullish(),
    period: periodSchema,
  })
  .optional()
  .default({});

export type PlatformAnalyticsInput = z.input<typeof platformInputSchema>;
export type OrganizationAnalyticsInput = z.input<
  typeof organizationInputSchema
>;

export const getPlatformAnalytics = platformAction(
  "getPlatformAnalytics",
  async (
    _actor,
    input?: PlatformAnalyticsInput
  ): Promise<ActionState<PlatformAnalytics>> => {
    const parsed = platformInputSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid filter." };
    try {
      const settings = await loadAnalyticsSettings();
      const data = await buildPlatformAnalytics({
        settings,
        requestedPeriod: parsed.data.period,
      });
      return { success: true, data };
    } catch (error) {
      logger.error({ err: error }, "[super-admin] platform analytics failed");
      return { success: false, error: LOAD_FAILED, message: LOAD_FAILED };
    }
  }
);

export const getOrganizationAnalytics = platformAction(
  "getOrganizationAnalytics",
  async (
    _actor,
    input?: OrganizationAnalyticsInput
  ): Promise<ActionState<OrganizationAnalytics>> => {
    const parsed = organizationInputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: NO_TENANT_MESSAGE };
    }
    try {
      const resolved = await resolveConsoleTenant(parsed.data.organizationId);
      if (!resolved.ok) {
        return {
          success: false,
          error: resolved.message,
          message: resolved.message,
        };
      }
      const settings = await loadAnalyticsSettings();
      const data = await buildOrganizationAnalytics({
        organizationId: resolved.tenant.id,
        settings,
        requestedPeriod: parsed.data.period,
      });
      if (!data) {
        return {
          success: false,
          error: NO_TENANT_MESSAGE,
          message: NO_TENANT_MESSAGE,
        };
      }
      return { success: true, data };
    } catch (error) {
      logger.error(
        { err: error },
        "[super-admin] organisation analytics failed"
      );
      return { success: false, error: LOAD_FAILED, message: LOAD_FAILED };
    }
  }
);
