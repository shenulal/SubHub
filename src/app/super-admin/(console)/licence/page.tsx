// src/app/super-admin/(console)/licence/page.tsx
/** Read-only licence view (placeholder until the HelloPixels licensing application). */
import {
  getLicenceOverview,
  type LicenceOverview,
} from "@/actions/super-admin/licence";
import { formatCount, formatPanelDate } from "@/components/super-admin/format";
import { PageHeading } from "@/components/super-admin/page-heading";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSystemSetting } from "@/lib/settings/service";
import { KeyRound, Lock } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Licence" };

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <dt className="text-muted-foreground shrink-0 text-[0.875rem]">
        {label}
      </dt>
      <dd
        className={`text-foreground min-w-0 truncate text-[0.9375rem] font-medium sm:text-right ${mono ? "font-mono text-[0.8125rem]" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

const limitText = (limit: number | null, used: string) =>
  `${used} · ${limit === null ? "no limit" : `${formatCount(limit)} allowed`}`;

function LicenceCard({
  data,
  timeZone,
}: {
  data: LicenceOverview;
  timeZone: string;
}) {
  const { license } = data;
  const edition =
    license.edition.charAt(0).toUpperCase() + license.edition.slice(1);
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="tonal-primary flex size-11 shrink-0 items-center justify-center rounded-md">
            <KeyRound className="size-5" />
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate">{edition} edition</CardTitle>
            <CardDescription className="truncate">
              Issued by {license.issuer}
            </CardDescription>
          </div>
        </div>
        <Badge
          variant={
            data.expired
              ? "error"
              : license.status === "active"
                ? "success"
                : "neutral"
          }
        >
          {data.expired
            ? "Expired"
            : license.status === "unlicensed"
              ? "Unlicensed"
              : license.status}
        </Badge>
      </CardHeader>
      <CardContent>
        <dl className="divide-y">
          <Row label="Licensee" value={license.licensee ?? "Not assigned"} />
          <Row
            label="Tenants"
            value={limitText(
              license.limits.maxTenants,
              `${formatCount(data.usage.tenants)} in use`
            )}
          />
          <Row
            label="Users per tenant"
            value={limitText(
              license.limits.maxUsersPerTenant,
              `${formatCount(data.usage.largestTenantUsers)} in the largest tenant`
            )}
          />
          <Row
            label="Expires"
            value={
              license.expiresAt
                ? formatPanelDate(license.expiresAt, timeZone)
                : "No expiry"
            }
          />
          <Row label="Deployment mode" value={data.deployment.label} />
          <Row label="Installation ID" value={data.installationId} mono />
          <Row label="Licence provider" value={data.providerId} mono />
        </dl>
      </CardContent>
    </Card>
  );
}

export default async function LicencePage() {
  const [result, timeZone] = await Promise.all([
    getLicenceOverview(),
    getSystemSetting("general.timezone"),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Licence"
        subtitle="Edition, limits and installation identity of this SubHub platform."
      />
      <div
        className="tonal-info flex min-w-0 items-start gap-3 rounded-md p-4 text-[0.875rem]"
        data-testid="licence-managed-notice"
      >
        <Lock className="mt-0.5 size-4 shrink-0" />
        <p className="min-w-0">
          Managed by the HelloPixels licensing application. This page is
          read-only; limits are read through the licence provider and are not
          enforced while the installation is unlicensed.
        </p>
      </div>
      {result.success && result.data ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <LicenceCard data={result.data} timeZone={timeZone} />
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Licensed features</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {result.data.license.features.map((f) => (
                <Badge key={f} variant="primary">
                  {f}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="tonal-error rounded-md p-3 text-[0.875rem]">
          {result.error}
        </p>
      )}
    </div>
  );
}
