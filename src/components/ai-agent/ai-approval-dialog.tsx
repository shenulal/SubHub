/**
 * AI Write Tool approval dialog
 * SMP-198: run the actual write operation after the user confirms
 * SMP-203: timeout (5 minutes) + concurrency guard (duplicate approvals)
 *
 * - Shows the operation and its impact
 * - Remaining-time countdown (5 minutes)
 * - [Cancel] / [Confirm] buttons
 * - Confirm click → PUT /api/ai/write → result callback
 */

"use client";

import { AlertTriangle, Clock } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type {
  WriteToolPendingAction,
  WriteToolResult,
} from "@/lib/ai/write-tool.types";

/** Approval timeout: 5 minutes (in seconds) */
const APPROVAL_TIMEOUT_SECONDS = 5 * 60;

interface AiApprovalDialogProps {
  open: boolean;
  pendingAction: WriteToolPendingAction | null;
  onConfirm: (result: WriteToolResult) => void;
  onCancel: () => void;
}

export function AiApprovalDialog({
  open,
  pendingAction,
  onConfirm,
  onCancel,
}: AiApprovalDialogProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(
    APPROVAL_TIMEOUT_SECONDS
  );
  // SMP-203: concurrency guard — track the pendingAction.id being executed
  const executingIdRef = useRef<string | null>(null);

  // Reset the timer whenever the dialog opens
  useEffect(() => {
    if (open && pendingAction) {
      setRemainingSeconds(APPROVAL_TIMEOUT_SECONDS);
      executingIdRef.current = null;
      setIsExecuting(false);
    }
  }, [open, pendingAction?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // SMP-203: countdown timer
  useEffect(() => {
    if (!open) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open]);

  // SMP-203: auto-cancel on timeout
  const handleTimeout = useCallback(() => {
    onConfirm({
      success: false,
      message:
        "The approval was cancelled because it timed out. Please submit the request again.",
    });
  }, [onConfirm]);

  useEffect(() => {
    if (remainingSeconds === 0 && open && !isExecuting) {
      handleTimeout();
    }
  }, [remainingSeconds, open, isExecuting, handleTimeout]);

  if (!pendingAction) return null;

  const isDestructive =
    pendingAction.action === "delete_app" ||
    pendingAction.action === "delete_subscription";

  const isTimedOut = remainingSeconds === 0;

  // Format the remaining time
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  async function handleConfirm() {
    if (!pendingAction) return;

    // SMP-203: concurrency guard — ignore if the same action is already running
    if (executingIdRef.current === pendingAction.id) return;
    if (isTimedOut) return;

    executingIdRef.current = pendingAction.id;
    setIsExecuting(true);

    try {
      const response = await fetch("/api/ai/write", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingAction }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Execution failed");
      onConfirm(data.result as WriteToolResult);
    } catch (error) {
      onConfirm({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "An error occurred during execution.",
      });
    } finally {
      setIsExecuting(false);
      executingIdRef.current = null;
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open: boolean) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-md ${isDestructive ? "tonal-error" : "tonal-warning"}`}
            >
              <AlertTriangle size={20} />
            </span>
            Confirm action
          </DialogTitle>
          <DialogDescription className="text-[0.9375rem]">
            {pendingAction.description}
          </DialogDescription>
        </DialogHeader>

        {pendingAction.impact && (
          <div className="bg-muted rounded-md p-4 text-[0.9375rem]">
            <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
              Impact
            </p>
            <p className="text-foreground break-words">
              {pendingAction.impact}
            </p>
          </div>
        )}

        {/* SMP-203: remaining time display */}
        <div className="flex items-center gap-2 text-[0.8125rem]">
          <Clock size={14} className="text-muted-foreground" />
          <span
            className={
              remainingSeconds <= 60
                ? "text-destructive font-medium"
                : "text-muted-foreground"
            }
          >
            Time remaining: {timeDisplay}
          </span>
        </div>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isExecuting}>
            Cancel
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isExecuting || isTimedOut}
          >
            {isExecuting
              ? "Executing..."
              : isTimedOut
                ? "Timed out"
                : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
