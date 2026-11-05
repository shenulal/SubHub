// FleetDM Webhook API
import type {
  FleetDMHostWebhookData,
  FleetDMSoftwareWebhookData,
} from "@/lib/services/fleetdm/types";
import {
  getOrganizationIdFromWebhook,
  handleHostEvent,
  handleSoftwareEvent,
  logWebhookEvent,
  parseWebhookEventType,
  verifyWebhookSignature,
} from "@/lib/services/fleetdm/webhook";
import { NextRequest, NextResponse } from "next/server";

const WEBHOOK_SECRET = process.env.FLEETDM_WEBHOOK_SECRET;

import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";

export const POST = withLogging(
  "webhook:fleetdm",
  async (request: NextRequest) => {
    const startTime = Date.now();

    try {
      // 1. Read the raw payload
      const rawBody = await request.text();

      // 2. Verify the signature (if configured)
      if (WEBHOOK_SECRET) {
        const signature = request.headers.get("x-fleet-signature");
        const isValid = verifyWebhookSignature(
          rawBody,
          signature,
          WEBHOOK_SECRET
        );

        if (!isValid) {
          await logWebhookEvent(
            "signature_verification",
            false,
            "Invalid signature"
          );
          return NextResponse.json(
            { error: "Invalid webhook signature" },
            { status: 401 }
          );
        }
      }

      // 3. Parse the payload
      let payload: {
        timestamp?: string;
        type?: string;
        data?: unknown;
        team_id?: number;
      };

      try {
        payload = JSON.parse(rawBody);
      } catch {
        await logWebhookEvent("parse", false, "Invalid JSON");
        return NextResponse.json(
          { error: "Invalid JSON payload" },
          { status: 400 }
        );
      }

      // 4. Validate the event type
      const eventType = parseWebhookEventType(payload.type || "");

      if (!eventType) {
        await logWebhookEvent(
          payload.type || "unknown",
          false,
          "Unknown event type"
        );
        return NextResponse.json(
          { error: `Unknown event type: ${payload.type}` },
          { status: 400 }
        );
      }

      // 5. Check the organization ID
      const organizationId = await getOrganizationIdFromWebhook(
        payload.team_id
      );

      if (!organizationId) {
        await logWebhookEvent(eventType, false, "Organization not found");
        return NextResponse.json(
          { error: "Organization not found for this webhook" },
          { status: 404 }
        );
      }

      // 6. Process the event
      switch (eventType) {
        case "host.created":
        case "host.updated":
        case "host.deleted":
        case "host.enrolled":
        case "host.unenrolled":
          await handleHostEvent(
            eventType,
            payload.data as FleetDMHostWebhookData,
            organizationId
          );
          break;

        case "software.installed":
        case "software.removed":
          await handleSoftwareEvent(
            eventType,
            payload.data as FleetDMSoftwareWebhookData,
            organizationId
          );
          break;

        case "vulnerability.detected":
        case "policy.failed":
          // TODO: handle vulnerability/policy events (Phase 2)
          logger.info(
            `[FleetDM Webhook] ${eventType} event received (not implemented)`
          );
          break;

        default:
          logger.info(`[FleetDM Webhook] Unhandled event type: ${eventType}`);
      }

      // 7. Success response
      const duration = Date.now() - startTime;
      await logWebhookEvent(eventType, true);

      return NextResponse.json({
        success: true,
        event: eventType,
        processed_at: new Date().toISOString(),
        duration_ms: duration,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await logWebhookEvent("unknown", false, errorMessage);

      logger.error({ err: error }, "[FleetDM Webhook] Error");

      return NextResponse.json(
        { error: "Internal server error", message: errorMessage },
        { status: 500 }
      );
    }
  }
);

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "fleetdm-webhook",
    timestamp: new Date().toISOString(),
  });
}
