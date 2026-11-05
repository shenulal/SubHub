/**
 * SubHub AI Agent Write Tool API Route
 * SMP-198: natural-language command → Write Tool parsing → pending-approval response
 * SMP-203: AI SDK v6 compatibility — switch from prompt to messages, pass ctx
 * SMP-204: server-side pending action validation — TTL + single use + tamper detection
 *
 * POST /api/ai/write  → natural-language parsing + pending-approval response
 * PUT  /api/ai/write  → actual execution after user approval (with server validation)
 */

import { anthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs } from "ai";
import { NextRequest, NextResponse } from "next/server";

import {
  storePendingAction,
  validateAndConsume,
} from "@/lib/ai/pending-action-store";
import { executeWriteTool, writeTools } from "@/lib/ai/write-tool";
import type { WriteToolPendingAction } from "@/lib/ai/write-tool.types";
import { requireOrganization } from "@/lib/auth/require-auth";

const MODEL = process.env.AI_MODEL ?? "claude-haiku-4-5";

const SYSTEM_PROMPT = `You are the SubHub AI assistant.
Analyze the user's natural-language commands and perform app create/update/delete or subscription change operations.

Important rules:
- Write operations (create/update/delete) are executed only after user approval
- Clearly explain the scope of impact before any operation
- If an app ID or subscription ID is required, ask the user to confirm it
- Ask the user to clarify any ambiguous command

Respond in English.`;

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const { organizationId, userId } = await requireOrganization();

    const body = await request.json();
    const { message } = body as { message: string };

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "message is required." },
        { status: 400 }
      );
    }

    // SMP-203: switch from prompt to the messages overload (AI SDK v6 compatible)
    const { text, toolResults } = await generateText({
      model: anthropic(MODEL),
      system: SYSTEM_PROMPT,
      messages: [{ role: "user" as const, content: message }],
      tools: writeTools,
      stopWhen: stepCountIs(1),
    });

    // Extract pendingAction
    const pendingActions = toolResults
      ?.filter(
        (r) => (r.output as { type?: string })?.type === "pending_approval"
      )
      .map(
        (r) =>
          (r.output as { pendingAction?: WriteToolPendingAction })
            ?.pendingAction
      )
      .filter(Boolean);

    // SMP-204: save the pending action in the server store
    if (pendingActions && pendingActions.length > 0) {
      for (const action of pendingActions) {
        if (action) {
          storePendingAction(
            action.id,
            action.action,
            action.params as unknown as Record<string, unknown>,
            organizationId,
            userId
          );
        }
      }

      return NextResponse.json({
        message:
          text ||
          "Please review the details below and approve to run this action.",
        pendingActions,
      });
    }

    return NextResponse.json({ message: text });
  } catch (error) {
    console.error("[AI Write Tool POST] Error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "An error occurred while processing the request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // SMP-203: pass auth info to the service via ctx
    const { organizationId, userId, role } = await requireOrganization();

    const body = await request.json();
    const { pendingAction } = body as { pendingAction: WriteToolPendingAction };

    if (!pendingAction) {
      return NextResponse.json(
        { error: "pendingAction is required." },
        { status: 400 }
      );
    }

    // SMP-204: server-side validation — TTL + single use + tamper detection + permission check
    const validation = validateAndConsume(
      pendingAction.id,
      pendingAction.params as unknown as Record<string, unknown>,
      organizationId,
      userId
    );

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status }
      );
    }

    const result = await executeWriteTool(pendingAction, {
      organizationId,
      userId,
      role,
    });
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[AI Write Tool PUT] Error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "An error occurred during execution.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
