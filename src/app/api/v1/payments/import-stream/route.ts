// src/app/api/v1/payments/import-stream/route.ts
/**
 * Payment CSV upload SSE streaming API
 * - Sends a progress event over SSE as each record is processed
 * - Clients receive it via EventSource or fetch + ReadableStream
 */

import type { PaymentImportResult } from "@/actions/payments/payment-import";
import { withApiAuth } from "@/lib/api/auth-middleware";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { parsePaymentCSV } from "@/lib/payment-csv";
import {
  type AppMatch,
  type CatalogWithPatterns,
} from "@/lib/services/payment/merchant-matcher";
import { normalizeMerchantName } from "@/lib/services/payment/merchant-matcher.utils";
import { processPaymentRecords } from "@/lib/services/payment/process-payment-records";
import { checkNonSaaSCache } from "@/lib/services/saas-matcher";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

// SSE event types
type SseEvent =
  | { type: "start"; total: number }
  | {
      type: "processing";
      index: number;
      total: number;
      merchantName: string;
      amount: number;
    }
  | { type: "saving" }
  | { type: "complete"; result: PaymentImportResult }
  | { type: "error"; message: string };

function formatSse(event: SseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export const POST = withApiAuth(
  async (request: NextRequest, { session }) => {
    const { organizationId } = session.user;

    // Parse the request body
    let csvContent: string;
    let teamId: string | undefined;
    let userId: string | undefined;

    try {
      const body = await request.json();
      csvContent = body.csvContent;
      teamId = body.teamId || undefined;
      userId = body.userId || undefined;
    } catch {
      return NextResponse.json(
        { error: "Invalid request format" },
        { status: 400 }
      );
    }

    if (!csvContent) {
      return NextResponse.json(
        { error: "CSV content is required" },
        { status: 400 }
      );
    }

    // Mutual exclusivity check
    if (teamId && userId) {
      return NextResponse.json(
        { error: "Select either a team or a user assignment, not both" },
        { status: 400 }
      );
    }

    // Validate teamId
    if (teamId) {
      const team = await prisma.team.findFirst({
        where: { id: teamId, organizationId },
      });
      if (!team) {
        return NextResponse.json({ error: "Invalid team" }, { status: 400 });
      }
    }

    // Validate userId
    if (userId) {
      const user = await prisma.user.findFirst({
        where: { id: userId, organizationId },
      });
      if (!user) {
        return NextResponse.json({ error: "Invalid user" }, { status: 400 });
      }
    }

    // Parse CSV
    const parseResult = parsePaymentCSV(csvContent);
    if (!parseResult.success || !parseResult.data) {
      return NextResponse.json(
        { error: parseResult.error || "Failed to parse the CSV file" },
        { status: 400 }
      );
    }
    if (parseResult.data.length === 0) {
      return NextResponse.json(
        { error: "No payment records to import" },
        { status: 400 }
      );
    }

    // Start the SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: SseEvent) => {
          controller.enqueue(new TextEncoder().encode(formatSse(event)));
        };

        try {
          // Fetch matching data
          const [apps, catalogs, customPatterns] = await Promise.all([
            prisma.app.findMany({
              where: { organizationId },
              select: { id: true, name: true, catalogId: true },
            }),
            prisma.saaSCatalog.findMany({
              include: {
                patterns: {
                  select: { pattern: true, matchType: true, confidence: true },
                },
              },
            }),
            prisma.merchantPattern.findMany({
              where: { organizationId, isActive: true },
              orderBy: { priority: "desc" },
            }),
          ]);

          const appMatches: AppMatch[] = apps.map(
            (app: { id: string; name: string; catalogId: string | null }) => ({
              id: app.id,
              name: app.name,
              catalogId: app.catalogId,
            })
          );

          const catalogsWithPatterns: CatalogWithPatterns[] = catalogs.map(
            (cat: {
              id: string;
              name: string;
              slug: string;
              patterns: Array<{
                pattern: string;
                matchType: string;
                confidence: number;
              }>;
            }) => ({
              id: cat.id,
              name: cat.name,
              slug: cat.slug,
              patterns: cat.patterns.map(
                (p: {
                  pattern: string;
                  matchType: string;
                  confidence: number;
                }) => ({
                  pattern: p.pattern,
                  matchType: p.matchType as
                    | "EXACT"
                    | "DOMAIN"
                    | "SUBDOMAIN"
                    | "REGEX",
                  confidence: p.confidence,
                })
              ),
            })
          );

          // Generate batch ID
          const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          // Duplicate check
          const approvalNumbers = parseResult
            .data!.map((row) => row.approvalNumber)
            .filter((num): num is string => !!num);

          const existingApprovals = await prisma.paymentRecord.findMany({
            where: {
              organizationId,
              approvalNumber: { in: approvalNumbers },
            },
            select: { approvalNumber: true },
          });

          const existingSet = new Set(
            existingApprovals.map((r) => r.approvalNumber).filter(Boolean)
          );

          const newRows = parseResult.data!.filter(
            (row) => !row.approvalNumber || !existingSet.has(row.approvalNumber)
          );
          const duplicateCount = parseResult.data!.length - newRows.length;

          if (newRows.length === 0) {
            send({
              type: "complete",
              result: {
                imported: 0,
                matched: 0,
                unmatched: 0,
                duplicates: duplicateCount,
                batchId,
              },
            });
            controller.close();
            return;
          }

          // Fetch the Non-SaaS cache
          const normalizedNames = newRows.map((r) =>
            normalizeMerchantName(r.merchantName)
          );
          const nonSaaSSet = await checkNonSaaSCache(
            organizationId,
            normalizedNames
          );

          // Send the start event
          send({ type: "start", total: newRows.length });

          // Process records (SSE events sent via onProgress)
          const { paymentRecords, matchedCount } = await processPaymentRecords({
            newRows,
            appMatches,
            catalogsWithPatterns,
            customPatterns,
            organizationId,
            teamId,
            userId,
            nonSaaSSet,
            batchId,
            onProgress: ({ index, total, merchantName, amount }) => {
              send({ type: "processing", index, total, merchantName, amount });
            },
          });

          // Send the saving event
          send({ type: "saving" });

          // Save to the DB
          const dbResult = await prisma.paymentRecord.createMany({
            data: paymentRecords as never[],
          });

          revalidatePath("/payments");

          // Send the complete event
          send({
            type: "complete",
            result: {
              imported: dbResult.count,
              matched: matchedCount,
              unmatched: dbResult.count - matchedCount,
              duplicates: duplicateCount,
              batchId,
              errors: parseResult.errors?.map((e) => ({
                row: e.row,
                message: e.message,
              })),
            },
          });
        } catch (error) {
          logger.error({ err: error }, "Payment CSV streaming error");
          send({
            type: "error",
            message: "An error occurred while importing payment records",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  },
  { permission: "payments:manage" }
);
