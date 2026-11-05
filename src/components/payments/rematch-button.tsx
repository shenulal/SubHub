// src/components/payments/rematch-button.tsx
"use client";

import {
  rematchCardTransactions,
  rematchPaymentRecords,
} from "@/actions/payments/payment-rematch";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

interface RematchButtonProps {
  selectedIds: string[];
  recordType: "payment" | "card-transaction";
  onComplete?: () => void;
}

export function RematchButton({
  selectedIds,
  recordType,
  onComplete,
}: RematchButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result =
        recordType === "payment"
          ? await rematchPaymentRecords(selectedIds)
          : await rematchCardTransactions(selectedIds);

      if (result.success) {
        const data = result.data;
        const msg = data
          ? `${data.matchedCount} matched, ${data.unmatchedCount} unmatched`
          : "Rematching complete";
        toast.success(msg);
      } else {
        toast.error(result.error ?? result.message ?? "Rematching failed");
      }

      onComplete?.();
    });
  };

  const isDisabled = selectedIds.length === 0 || isPending;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isDisabled}
    >
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="mr-2 h-4 w-4" />
      )}
      Rematch
      {selectedIds.length > 0 && (
        <span className="text-muted-foreground ml-1">
          ({selectedIds.length})
        </span>
      )}
    </Button>
  );
}
