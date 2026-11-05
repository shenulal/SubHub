"use client";
// src/components/org/org-sync-form.tsx

import { syncOrgsFromCSV, syncUsersFromCSV } from "@/actions/org-sync";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  generateOrgCSVTemplate,
  generateUserSyncCSVTemplate,
} from "@/lib/csv-org";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Download,
  FileUp,
  Info,
  Loader2,
  Upload,
  Users,
} from "lucide-react";
import { useCallback, useState, useTransition } from "react";

// ==================== Types ====================

interface SyncResult {
  success: boolean;
  message: string;
  created?: number;
  updated?: number;
  errors?: Array<{ row: number; field: string; message: string }>;
}

// ==================== CSV upload panel ====================

function CsvUploadPanel({
  label,
  icon: Icon,
  template,
  templateFilename,
  onUpload,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  template: string;
  templateFilename: string;
  onUpload: (csvContent: string) => Promise<SyncResult>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (
      dropped &&
      (dropped.type === "text/csv" || dropped.name.endsWith(".csv"))
    ) {
      setFile(dropped);
      setResult(null);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleUpload = () => {
    if (!file) return;
    startTransition(async () => {
      const csvContent = await file.text();
      const res = await onUpload(csvContent);
      setResult(res);
    });
  };

  const downloadTemplate = () => {
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = templateFilename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Template download */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={downloadTemplate}
        >
          <Download className="mr-2 h-4 w-4" />
          Download template
        </Button>
        <span className="text-muted-foreground text-sm">
          Follow the CSV format guide
        </span>
      </div>

      {/* Drag-and-drop upload area */}
      <div
        className={`relative rounded-md border-2 border-dashed p-8 text-center transition-colors ${
          dragActive
            ? "border-primary bg-primary/[0.08]"
            : "border-border hover:border-primary/60"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        <div className="tonal-primary mx-auto mb-3 flex size-12 items-center justify-center rounded-md">
          <Icon className="size-6" />
        </div>
        <p className="mb-1 font-medium">
          Drag and drop the {label} CSV file, or click to select
        </p>
        <p className="text-muted-foreground text-sm">
          Only CSV files are supported
        </p>
      </div>

      {/* Selected file */}
      {file && (
        <div className="bg-muted flex min-w-0 items-center justify-between gap-3 rounded-md px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={file.name}>
              {file.name}
            </p>
            <p className="text-muted-foreground text-xs">
              {(file.size / 1024).toFixed(2)} KB
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setFile(null);
              setResult(null);
            }}
          >
            Remove
          </Button>
        </div>
      )}

      {/* Upload button */}
      <Button
        onClick={handleUpload}
        disabled={!file || isPending}
        className="w-full"
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Syncing...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Start sync
          </>
        )}
      </Button>

      {/* Result */}
      {result && (
        <Alert variant={result.success ? "default" : "destructive"}>
          {result.success ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle>{result.success ? "Completed" : "Error"}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{result.message}</p>
            {result.success &&
              (result.created !== undefined ||
                result.updated !== undefined) && (
                <p className="text-sm">
                  Created {result.created ?? 0} · Updated {result.updated ?? 0}
                </p>
              )}
            {result.errors && result.errors.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {result.errors.slice(0, 5).map((err, i) => (
                  <li key={i} className="text-destructive">
                    {err.message}
                  </li>
                ))}
                {result.errors.length > 5 && (
                  <li className="text-muted-foreground">
                    and {result.errors.length - 5} more errors...
                  </li>
                )}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ==================== Main component ====================

export function OrgSyncForm() {
  const handleOrgSync = async (csvContent: string): Promise<SyncResult> => {
    const res = await syncOrgsFromCSV(csvContent);
    return {
      success: res.success,
      message: res.message ?? "",
      created: res.data?.created,
      updated: res.data?.updated,
      errors: res.data?.errors,
    };
  };

  const handleUserSync = async (csvContent: string): Promise<SyncResult> => {
    const res = await syncUsersFromCSV(csvContent);
    return {
      success: res.success,
      message: res.message ?? "",
      created: res.data?.created,
      updated: res.data?.updated,
      errors: res.data?.errors,
    };
  };

  return (
    <Tabs defaultValue="csv" className="w-full">
      {/* Integration method tabs */}
      <TabsList className="mb-6">
        <TabsTrigger value="csv">CSV file</TabsTrigger>
        <TabsTrigger value="ad" disabled>
          Active Directory
          <Badge variant="secondary" className="ml-2">
            Coming soon
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="hr" disabled>
          HR system
          <Badge variant="secondary" className="ml-2">
            Coming soon
          </Badge>
        </TabsTrigger>
      </TabsList>

      {/* ── Tab 1: CSV file upload ── */}
      <TabsContent value="csv" className="space-y-6">
        {/* Recommended order banner */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Recommended upload order</AlertTitle>
          <AlertDescription>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="tonal-primary rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap">
                Step 1. Upload the organization structure CSV
              </span>
              <ArrowRight className="text-muted-foreground h-4 w-4 shrink-0" />
              <span className="tonal-primary rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap">
                Step 2. Upload the user CSV
              </span>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              Registering the organization structure first assigns users to the
              correct organization names. Uploads still work in any order.
            </p>
          </AlertDescription>
        </Alert>

        {/* Inner tabs: ① Organization structure / ② User sync */}
        <Tabs defaultValue="org-struct">
          <TabsList className="mb-4">
            <TabsTrigger value="org-struct">
              ① Organization structure
            </TabsTrigger>
            <TabsTrigger value="user-sync">② User sync</TabsTrigger>
          </TabsList>

          <TabsContent value="org-struct">
            <Card>
              <CardHeader>
                <CardTitle className="flex min-w-0 items-center gap-3">
                  <span className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md">
                    <Building2 className="size-5" />
                  </span>
                  Upload organization structure CSV
                </CardTitle>
                <CardDescription>
                  Upload a CSV with org_code, parent_code and org_name columns.
                  The hierarchy is set by parent_code; rows without one are
                  registered as top-level organizations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CsvUploadPanel
                  label="Organization structure"
                  icon={Building2}
                  template={generateOrgCSVTemplate()}
                  templateFilename="org_structure_template.csv"
                  onUpload={handleOrgSync}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="user-sync">
            <Card>
              <CardHeader>
                <CardTitle className="flex min-w-0 items-center gap-3">
                  <span className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md">
                    <Users className="size-5" />
                  </span>
                  Upload user sync CSV
                </CardTitle>
                <CardDescription>
                  Upload a CSV with employee_id, name, email and org_code
                  columns. Users are upserted by email and assigned to an
                  organization automatically by org_code.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CsvUploadPanel
                  label="User sync"
                  icon={FileUp}
                  template={generateUserSyncCSVTemplate()}
                  templateFilename="user_sync_template.csv"
                  onUpload={handleUserSync}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </TabsContent>

      {/* ── Tab 2: Active Directory (disabled) ── */}
      <TabsContent value="ad">
        <Card>
          <CardHeader>
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <CardTitle className="min-w-0">
                Active Directory / LDAP integration
              </CardTitle>
              <Badge variant="warning">Coming soon</Badge>
            </div>
            <CardDescription>
              AD integration will be supported in a future update
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">LDAP server URL</Label>
              <Input disabled placeholder="ldap://your-dc.company.com" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Bind DN</Label>
              <Input disabled placeholder="CN=admin,DC=company,DC=com" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Bind password</Label>
              <Input type="password" disabled placeholder="••••••••••••" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Base DN</Label>
              <Input disabled placeholder="DC=company,DC=com" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Sync frequency</Label>
              <Select disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Automatic daily sync" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="DAILY">Automatic daily sync</SelectItem>
                  <SelectItem value="WEEKLY">Automatic weekly sync</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <Button disabled variant="outline">
                Test connection
              </Button>
              <Button disabled>Start sync</Button>
            </div>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                AD integration will be supported in a future update
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Tab 3: HR system (disabled) ── */}
      <TabsContent value="hr">
        <Card>
          <CardHeader>
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <CardTitle className="min-w-0">HR system integration</CardTitle>
              <Badge variant="warning">Coming soon</Badge>
            </div>
            <CardDescription>
              HR system integration will be supported in a future update
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">System type</Label>
              <Select disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Select HR system" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SAP">SAP</SelectItem>
                  <SelectItem value="DOUZONE">Douzone</SelectItem>
                  <SelectItem value="GROUPWARE">Groupware</SelectItem>
                  <SelectItem value="CUSTOM_API">Custom API</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">API Endpoint</Label>
              <Input disabled placeholder="https://hr.company.com/api" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">API Key</Label>
              <Input type="password" disabled placeholder="••••••••••••" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Sync frequency</Label>
              <Select disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Automatic daily sync" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="DAILY">Automatic daily sync</SelectItem>
                  <SelectItem value="WEEKLY">Automatic weekly sync</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <Button disabled variant="outline">
                Test connection
              </Button>
              <Button disabled>Start sync</Button>
            </div>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                HR system integration will be supported in a future update
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
