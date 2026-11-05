// src/components/import/field-mapping-dialog.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, Check, Settings2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

// SubHub PaymentRecord field definitions
const PAYMENT_FIELDS = [
  { key: "date", label: "Date (required)", required: true },
  { key: "merchant", label: "SaaS name / merchant (required)", required: true },
  { key: "amount", label: "Amount (required)", required: true },
  { key: "category", label: "Account", required: false },
  { key: "memo", label: "Description / memo", required: false },
  { key: "cardLast4", label: "Card last 4 digits", required: false },
  { key: "approvalNumber", label: "Approval number", required: false },
] as const;

type PaymentFieldKey = (typeof PAYMENT_FIELDS)[number]["key"];

/** Field mapping result */
export interface FieldMappingResult {
  /** CSV column → PaymentRecord field mapping */
  fieldMappings: Record<string, PaymentFieldKey | "">;
  /** Whether double-entry mode is enabled */
  doubleEntryEnabled: boolean;
  /** Double-entry settings */
  doubleEntryConfig?: {
    debitAccountColumn: string;
    creditAccountColumn: string;
    expensePrefix: string;
  };
  /** Profile name (when saving) */
  profileName?: string;
}

interface FieldMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** CSV headers */
  csvHeaders: string[];
  /** CSV sample data (up to 3 rows) */
  sampleRows: Record<string, string>[];
  /** Callback when the mapping is confirmed */
  onConfirm: (mapping: FieldMappingResult) => void;
  /** Existing mapping (when editing) */
  initialMapping?: Partial<FieldMappingResult>;
}

export function FieldMappingDialog({
  open,
  onOpenChange,
  csvHeaders,
  sampleRows,
  onConfirm,
  initialMapping,
}: FieldMappingDialogProps) {
  // Field mapping state: { csvColumn: paymentField }
  const [mappings, setMappings] = useState<
    Record<string, PaymentFieldKey | "">
  >(() => initialMapping?.fieldMappings ?? {});

  const [doubleEntryEnabled, setDoubleEntryEnabled] = useState(
    initialMapping?.doubleEntryEnabled ?? false
  );
  const [debitColumn, setDebitColumn] = useState(
    initialMapping?.doubleEntryConfig?.debitAccountColumn ?? ""
  );
  const [creditColumn, setCreditColumn] = useState(
    initialMapping?.doubleEntryConfig?.creditAccountColumn ?? ""
  );
  const [expensePrefix, setExpensePrefix] = useState(
    initialMapping?.doubleEntryConfig?.expensePrefix ?? "8"
  );

  // Track already-mapped fields (prevents duplicates)
  const usedPaymentFields = useMemo(() => {
    const used = new Set<string>();
    for (const field of Object.values(mappings)) {
      if (field) used.add(field);
    }
    return used;
  }, [mappings]);

  // Whether all required fields are mapped
  const requiredFieldsMapped = useMemo(() => {
    const requiredKeys = PAYMENT_FIELDS.filter((f) => f.required).map(
      (f) => f.key
    );
    return requiredKeys.every((key) => usedPaymentFields.has(key));
  }, [usedPaymentFields]);

  const handleMappingChange = useCallback(
    (csvColumn: string, paymentField: PaymentFieldKey | "") => {
      setMappings((prev) => ({ ...prev, [csvColumn]: paymentField }));
    },
    []
  );

  const handleConfirm = () => {
    const result: FieldMappingResult = {
      fieldMappings: mappings,
      doubleEntryEnabled,
    };
    if (doubleEntryEnabled && debitColumn) {
      result.doubleEntryConfig = {
        debitAccountColumn: debitColumn,
        creditAccountColumn: creditColumn,
        expensePrefix,
      };
    }
    onConfirm(result);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-[95vw] max-w-5xl overflow-x-hidden overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            CSV field mapping
          </DialogTitle>
          <DialogDescription>
            Map the CSV columns to SubHub payment fields. The required fields
            (date, SaaS name, amount) must be mapped.
          </DialogDescription>
        </DialogHeader>

        {/* Sample data preview */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">CSV data preview</Label>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  {csvHeaders.map((header) => (
                    <th
                      key={header}
                      className="px-3 py-2 text-left font-medium whitespace-nowrap"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleRows.slice(0, 3).map((row, i) => (
                  <tr key={i} className="border-t">
                    {csvHeaders.map((header) => (
                      <td
                        key={header}
                        className="text-muted-foreground px-3 py-1.5 whitespace-nowrap"
                      >
                        {row[header] || "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Field mapping */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Field mapping</Label>
          <div className="space-y-2">
            {csvHeaders.map((csvColumn) => (
              <div
                key={csvColumn}
                className="flex items-center gap-3 rounded-md border px-3 py-2"
              >
                <span className="min-w-[140px] truncate font-mono text-sm">
                  {csvColumn}
                </span>
                <span className="text-muted-foreground text-xs">→</span>
                <Select
                  value={mappings[csvColumn] || ""}
                  onValueChange={(v) =>
                    handleMappingChange(
                      csvColumn,
                      v === "__none__" ? "" : (v as PaymentFieldKey)
                    )
                  }
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Do not map" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Do not map</SelectItem>
                    {PAYMENT_FIELDS.map((field) => (
                      <SelectItem
                        key={field.key}
                        value={field.key}
                        disabled={
                          usedPaymentFields.has(field.key) &&
                          mappings[csvColumn] !== field.key
                        }
                      >
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mappings[csvColumn] && (
                  <Badge variant="secondary" className="text-xs">
                    <Check className="mr-1 h-3 w-3" />
                    Mapped
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Double-entry settings */}
        <div className="space-y-3 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Double-entry mode</Label>
              <p className="text-muted-foreground text-xs">
                Enable this for ERP data with a debit/credit structure
              </p>
            </div>
            <Switch
              checked={doubleEntryEnabled}
              onCheckedChange={setDoubleEntryEnabled}
            />
          </div>

          {doubleEntryEnabled && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Debit account column</Label>
                  <Select value={debitColumn} onValueChange={setDebitColumn}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {csvHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Credit account column</Label>
                  <Select value={creditColumn} onValueChange={setCreditColumn}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {csvHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  Expense account prefixes (comma-separated)
                </Label>
                <Input
                  value={expensePrefix}
                  onChange={(e) => setExpensePrefix(e.target.value)}
                  placeholder="e.g. 8, 6 (extracts 8xxx and 6xxx accounts only)"
                  className="text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Mapping status summary */}
        <div className="flex items-center gap-2 text-sm">
          {requiredFieldsMapped ? (
            <Badge variant="success">
              <Check className="mr-1 h-3 w-3" />
              All required fields mapped
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertCircle className="mr-1 h-3 w-3" />
              Map all required fields
            </Badge>
          )}
          <span className="text-muted-foreground">
            {Object.values(mappings).filter(Boolean).length}/{csvHeaders.length}{" "}
            columns mapped
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!requiredFieldsMapped}>
            Apply mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
