/**
 * SubHub AI Agent Chat API Route
 * SMP-197: real-time chat via streamText with automatic Read Tool execution
 * SMP-198: Write Tool integration — pending-approval pattern (pending_approval)
 * SMP-204: server-side pending action storage — detected in onStepFinish and registered in the store
 *
 * POST /api/ai/chat → streaming response (works with the useChat hook)
 */

import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, stepCountIs, streamText } from "ai";

import { storePendingAction } from "@/lib/ai/pending-action-store";
import { buildSystemPrompt } from "@/lib/ai/prompts/system-prompt";
import { readTools } from "@/lib/ai/read-tool";
import { writeTools } from "@/lib/ai/write-tool";
import { requireOrganization } from "@/lib/auth/require-auth";

const MODEL = process.env.AI_MODEL ?? "claude-haiku-4-5";

export async function POST(request: Request) {
  try {
    const { organizationId, userId, role } = await requireOrganization();

    const { messages } = await request.json();

    const result = streamText({
      model: anthropic(MODEL),
      system: buildSystemPrompt({
        organizationName: organizationId,
        role,
      }),
      messages: await convertToModelMessages(messages),
      tools: { ...readTools, ...writeTools },
      stopWhen: stepCountIs(5),
      // SMP-204: on each completed step, detect pending_approval → register in the server store
      onStepFinish: ({ toolResults }) => {
        if (!toolResults) return;
        for (const tr of toolResults) {
          const output = tr.output as {
            type?: string;
            pendingAction?: {
              id: string;
              action: string;
              params: Record<string, unknown>;
            };
          };
          if (output?.type === "pending_approval" && output?.pendingAction) {
            storePendingAction(
              output.pendingAction.id,
              output.pendingAction.action,
              output.pendingAction.params,
              organizationId,
              userId
            );
          }
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[AI Chat] Error:", error);
    return new Response(
      JSON.stringify({
        error: "An error occurred while processing the request.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
