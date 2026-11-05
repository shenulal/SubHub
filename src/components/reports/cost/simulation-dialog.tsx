// src/app/(dashboard)/reports/cost/_components/simulation-dialog.tsx
"use client";

import { simulateSeatReduction } from "@/actions/seat-optimization";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { DEFAULT_BASE_CURRENCY, formatMoney } from "@/lib/fx/convert";
import type {
  SeatOptimizationItem,
  SimulationResult,
} from "@/types/seat-analytics";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

function formatCurrency(value: number, currency = DEFAULT_BASE_CURRENCY) {
  return formatMoney(value, currency);
}

export function SimulationDialog({
  item,
  onClose,
}: {
  item: SeatOptimizationItem;
  onClose: () => void;
}) {
  const [targetSeats, setTargetSeats] = useState(item.recommendedSeats);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const runSimulation = useCallback(
    async (target: number) => {
      setIsSimulating(true);
      const result = await simulateSeatReduction(item.subscriptionId, target);
      if (result.success && result.data) {
        setSimulation(result.data);
      }
      setIsSimulating(false);
    },
    [item.subscriptionId]
  );

  useEffect(() => {
    runSimulation(targetSeats);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSliderChange = (value: number[]) => {
    const newTarget = value[0];
    setTargetSeats(newTarget);
    runSimulation(newTarget);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{item.appName} - Seat Reduction Simulation</DialogTitle>
          <DialogDescription>
            Adjust the slider to see the savings at different seat counts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Target seats</span>
              <span className="font-medium tabular-nums">{targetSeats}</span>
            </div>
            <Slider
              min={1}
              max={item.currentSeats}
              step={1}
              value={[targetSeats]}
              onValueChange={handleSliderChange}
            />
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>1</span>
              <span>Current: {item.currentSeats}</span>
            </div>
          </div>

          {isSimulating ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : simulation ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-muted min-w-0 rounded-md p-4">
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Current cost
                    </p>
                    <p className="truncate text-xl font-medium tabular-nums">
                      {formatCurrency(simulation.currentMonthlyCost)}
                      <span className="text-muted-foreground text-xs font-normal">
                        /mo
                      </span>
                    </p>
                  </div>
                </div>
                <div className="bg-muted min-w-0 rounded-md p-4">
                  <div>
                    <p className="text-muted-foreground text-xs">Target cost</p>
                    <p className="truncate text-xl font-medium tabular-nums">
                      {formatCurrency(simulation.targetMonthlyCost)}
                      <span className="text-muted-foreground text-xs font-normal">
                        /mo
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="tonal-success min-w-0 rounded-md p-4">
                <div>
                  <p className="text-sm font-medium">Potential savings</p>
                  <p className="text-xl font-medium tabular-nums">
                    {formatCurrency(simulation.monthlySavings)}/mo (
                    {formatCurrency(simulation.annualSavings)}/yr)
                  </p>
                </div>
              </div>

              {simulation.affectedUsers.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">
                    Affected inactive users ({simulation.affectedUsers.length})
                  </p>
                  <div className="max-h-32 overflow-y-auto rounded-md border">
                    <Table>
                      <TableBody>
                        {simulation.affectedUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="py-1.5 text-sm">
                              {user.name ?? user.email}
                            </TableCell>
                            <TableCell className="py-1.5 text-right text-xs">
                              {user.email}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
