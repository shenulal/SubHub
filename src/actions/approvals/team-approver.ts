// src/actions/approvals/team-approver.ts
"use server";

/**
 * Feature 2.3 — default approver per team (used by TEAM_APPROVER steps and as
 * the MANAGER fallback).
 */
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import { recordAudit } from "@/lib/services/approval/audit";
import { setTeamApproverSchema } from "@/lib/validations/approvals";
import type { ActionState } from "@/types";
import type { ApprovalUserRef } from "@/types/approval";
import { revalidatePath } from "next/cache";
import { runAction, USER_REF_SELECT } from "./shared";

export interface TeamApproverRow {
  id: string;
  name: string;
  approver: ApprovalUserRef | null;
  memberCount: number;
}

export interface TeamApproverOptions {
  teams: TeamApproverRow[];
  users: ApprovalUserRef[];
}

async function _getTeamApproverOptions(): Promise<
  ActionState<TeamApproverOptions>
> {
  return runAction("getTeamApproverOptions", async () => {
    const { organizationId } = await requirePermission(
      "approval_policies:read"
    );
    const [teams, users] = await Promise.all([
      prisma.team.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          approver: { select: USER_REF_SELECT },
          _count: { select: { members: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { organizationId, status: "ACTIVE" },
        select: USER_REF_SELECT,
        orderBy: [{ name: "asc" }, { email: "asc" }],
      }),
    ]);
    return {
      success: true,
      data: {
        teams: teams.map((t) => ({
          id: t.id,
          name: t.name,
          approver: t.approver,
          memberCount: t._count.members,
        })),
        users,
      },
    };
  });
}
export const getTeamApproverOptions = withLogging(
  "getTeamApproverOptions",
  _getTeamApproverOptions
);

async function _setTeamApprover(
  teamId: string,
  userId: string | null
): Promise<ActionState<null>> {
  return runAction("setTeamApprover", async () => {
    const ctx = await requirePermission("approval_policies:manage");
    const parsed = setTeamApproverSchema.safeParse({ teamId, userId });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    const team = await prisma.team.findFirst({
      where: { id: parsed.data.teamId, organizationId: ctx.organizationId },
      select: { id: true, approverId: true },
    });
    if (!team) return { success: false, error: "Team not found" };
    if (parsed.data.userId) {
      const user = await prisma.user.findFirst({
        where: { id: parsed.data.userId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!user) return { success: false, error: "User not found" };
    }
    await prisma.team.update({
      where: { id: team.id },
      data: { approverId: parsed.data.userId },
    });
    await recordAudit(prisma, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "UPDATE_TEAM_APPROVER",
      entityType: "team",
      entityId: team.id,
      changes: { from: team.approverId, to: parsed.data.userId },
    });
    revalidatePath("/settings/organization");
    revalidatePath("/settings/approvals");
    return { success: true, data: null };
  });
}
export const setTeamApprover = withLogging("setTeamApprover", _setTeamApprover);
