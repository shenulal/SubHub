// src/components/super-admin/tenants/tenant-detail-view.tsx
/**
 * One tenant in the Control Panel: status and lifecycle actions, usage, users by
 * role, defaults and licence limits, administrators, profile edit and recent
 * platform activity. Used by Tenants → detail (SaaS) and Installation (single-tenant).
 */
import type { TenantDetail } from "@/actions/super-admin/tenants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Activity, AppWindow, CreditCard, Users } from "lucide-react";
import Link from "next/link";
import { AuditTable } from "../audit/audit-table";
import { formatCount, formatPanelDate, ROLE_LABELS } from "../format";
import { TenantSettingsForm } from "../tenant-settings-form";
import { TenantStatusButton } from "../tenant-status-button";
import { DeleteTenantDialog } from "./delete-tenant-dialog";
import { TenantAdminsCard } from "./tenant-admins-card";

interface Props {
  detail: TenantDetail;
  saas: boolean;
  timeZone: string;
}

const plural = (n: number, word: string) =>
  `${formatCount(n)} ${n === 1 ? word : `${word}s`}`;

function Kpi({
  icon: Icon,
  label,
  value,
  caption,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <Card>
      <CardContent className="flex min-w-0 items-center gap-4 p-5">
        <span className="tonal-primary flex size-11 shrink-0 items-center justify-center rounded-md">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-muted-foreground truncate text-[0.8125rem]">
            {label}
          </p>
          <p
            className="text-foreground truncate text-2xl font-medium tabular-nums"
            title={value}
          >
            {value}
          </p>
          <p className="text-muted-foreground truncate text-[0.8125rem]">
            {caption}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground shrink-0 text-[0.875rem]">
        {label}
      </dt>
      <dd
        className="text-foreground min-w-0 truncate text-right text-[0.9375rem] font-medium"
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function Header({ detail, saas, timeZone }: Props) {
  const query = saas ? `?org=${detail.id}` : "";
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="flex min-w-0 items-center gap-2 text-xl">
            <span className="truncate" title={detail.name}>
              {detail.name}
            </span>
            <Badge variant={detail.deactivatedAt ? "warning" : "success"}>
              {detail.deactivatedAt ? "Suspended" : "Active"}
            </Badge>
          </CardTitle>
          <CardDescription className="truncate">
            {detail.domain ?? "No primary domain"} · Created{" "}
            {formatPanelDate(detail.createdAt, timeZone)} · ID{" "}
            <code className="font-mono text-xs">{detail.id}</code>
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/super-admin/extension-builds${query}`}>
              Extension builds
            </Link>
          </Button>
          {saas && (
            <TenantStatusButton
              tenantId={detail.id}
              tenantName={detail.name}
              deactivated={Boolean(detail.deactivatedAt)}
            />
          )}
          {saas && (
            <DeleteTenantDialog
              organizationId={detail.id}
              tenantName={detail.name}
            />
          )}
        </div>
      </CardHeader>
      {detail.deactivatedAt && (
        <CardContent>
          <p className="tonal-warning rounded-md p-3 text-[0.875rem]">
            Suspended on {formatPanelDate(detail.deactivatedAt, timeZone)}.
            Members cannot sign in to the workspace until it is reactivated;
            data is kept.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

export function TenantDetailView({ detail, saas, timeZone }: Props) {
  const { usage, licence } = detail;
  const userLimit =
    licence.maxUsersPerTenant === null
      ? "Unlimited"
      : formatCount(licence.maxUsersPerTenant);
  return (
    <div className="flex flex-col gap-6" data-testid="tenant-detail">
      <Header detail={detail} saas={saas} timeZone={timeZone} />
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={Users}
          label="Users"
          value={formatCount(usage.users)}
          caption={`${formatCount(usage.activeUsers)} active`}
        />
        <Kpi
          icon={CreditCard}
          label="Active subscriptions"
          value={formatCount(usage.activeSubscriptions)}
          caption={`${formatCount(usage.subscriptions)} in total`}
        />
        <Kpi
          icon={AppWindow}
          label="Apps"
          value={formatCount(usage.apps)}
          caption={`${plural(usage.teams, "team")} · ${plural(usage.integrations, "integration")}`}
        />
        <Kpi
          icon={Activity}
          label="Last activity"
          value={formatPanelDate(detail.lastActivityAt, timeZone)}
          caption="Latest member sign-in"
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Users by role</CardTitle>
          </CardHeader>
          <CardContent>
            {detail.usersByRole.length === 0 ? (
              <p className="text-muted-foreground text-[0.875rem]">
                No users yet.
              </p>
            ) : (
              <dl className="divide-y">
                {detail.usersByRole.map((r) => (
                  <Fact
                    key={r.role}
                    label={ROLE_LABELS[r.role] ?? r.role}
                    value={formatCount(r.count)}
                  />
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Plan, limits and defaults</CardTitle>
            <CardDescription>
              Limits come from the licence (managed by the HelloPixels licensing
              application).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              <Fact
                label="Licence edition"
                value={
                  licence.edition.charAt(0).toUpperCase() +
                  licence.edition.slice(1)
                }
              />
              <Fact
                label="Users (used / allowed)"
                value={`${formatCount(usage.users)} / ${userLimit}`}
              />
              <Fact label="Country" value={detail.defaults.countryCode} />
              <Fact
                label="Base currency"
                value={detail.defaults.baseCurrency}
              />
              <Fact label="Time zone" value={detail.defaults.timezone} />
            </dl>
          </CardContent>
        </Card>
      </div>
      <TenantAdminsCard detail={detail} timeZone={timeZone} />
      <Card>
        <CardHeader>
          <CardTitle>Edit information</CardTitle>
          <CardDescription>
            Organisation name, primary domain and logo URL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TenantSettingsForm
            tenant={{
              id: detail.id,
              name: detail.name,
              domain: detail.domain,
              logoUrl: detail.logoUrl,
              createdAt: detail.createdAt,
              deactivatedAt: detail.deactivatedAt,
              userCount: usage.users,
              subscriptionCount: usage.subscriptions,
            }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Recent platform activity</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link href={`/super-admin/audit?organizationId=${detail.id}`}>
              Full audit log
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          <AuditTable
            rows={detail.audit}
            timeZone={timeZone}
            showTenant={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
