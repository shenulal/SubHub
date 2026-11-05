// src/app/(super-admin)/extension-builds/page.tsx
import { listExtensionBuilds } from "@/actions/super-admin/extension-builds";
import { ExtensionBuildsTable } from "@/components/super-admin/extension-builds-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Extension Builds | Super Admin",
};

export default async function ExtensionBuildsPage() {
  const result = await listExtensionBuilds();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-foreground text-2xl font-medium">
          Extension Builds
        </h1>
        <p className="text-muted-foreground text-[0.9375rem]">
          Manage browser extension builds.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Builds</CardTitle>
          <CardDescription>
            Create a new build or download an existing one.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {result.success && result.data ? (
            <ExtensionBuildsTable initialBuilds={result.data} />
          ) : (
            <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
              {result.message ?? "Unable to load data."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
