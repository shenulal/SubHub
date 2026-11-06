// src/app/(dashboard)/settings/team/page.tsx
import { getInvitations } from "@/actions/invitations";
import { getTeams } from "@/actions/teams";
import { PageHeader } from "@/components/common/page-header";
import { InvitationsTable } from "@/components/settings/invitations-table";
import { InviteMemberInlineForm } from "@/components/team/invite-member-inline-form";
import { MemberList } from "@/components/team/member-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/** Section panel nested inside the settings content card: outlined, no second shadow. */
const NESTED_CARD = "border-border dark:border-border rounded-md shadow-none";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("teamMembers.page");
  return {
    title: `${t("title")}`,
    description: t("description"),
  };
}

export default async function TeamPage() {
  const { permissions } = await requirePermissionOrRedirect(
    ["members:invite", "members:manage"],
    "/settings",
    { mode: "any" }
  );
  const canManageMembers = permissions.has("members:manage");
  const canInvite = permissions.has("members:invite");
  const t = await getTranslations("teamMembers.page");
  const tMemberList = await getTranslations("teamMembers.memberList");
  const { organizationId, userId } = await requireOrganization();

  const [invitations, teamsResult, members] = await Promise.all([
    getInvitations(),
    getTeams(),
    prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        image: true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
  ]);

  const teams = teamsResult.success && teamsResult.data ? teamsResult.data : [];
  const tForm = await getTranslations("teamMembers.inviteForm");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        showBack
        backHref="/settings"
      />

      <Card className={NESTED_CARD}>
        <CardHeader>
          <CardTitle>{tMemberList("title")}</CardTitle>
          <CardDescription>{tMemberList("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {tMemberList("empty")}
            </p>
          ) : (
            <MemberList
              members={members}
              currentUserId={userId}
              isAdmin={canManageMembers}
            />
          )}
        </CardContent>
      </Card>

      {canInvite && (
        <Card className={NESTED_CARD}>
          <CardHeader>
            <CardTitle>{tForm("title")}</CardTitle>
            <CardDescription>{tForm("description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <InviteMemberInlineForm
              teams={teams.map((team) => ({ id: team.id, name: team.name }))}
            />
          </CardContent>
        </Card>
      )}

      <InvitationsTable
        invitations={
          invitations.success && invitations.data ? invitations.data : []
        }
      />
    </div>
  );
}
