// src/lib/services/approval/step-resolver.ts
/**
 * Turns the abstract approver definitions of a policy into concrete users.
 *
 *  USER          → that user (must be active in the organisation)
 *  MANAGER       → requester.managerId → team approver → administrators
 *  TEAM_APPROVER → requester.team.approverId → manager → administrators
 *  ROLE          → every active user with that role (first decision wins)
 *
 * Unless `approvals.allowSelfApproval` is on, the requester is removed from the
 * candidate list; an empty list means the step is skipped.
 */
import { prisma } from "@/lib/db";
import type { ApprovalPolicyStep, Prisma, UserRole } from "@prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

export interface RequesterContext {
  id: string;
  managerId: string | null;
  teamId: string | null;
}

export interface ResolvedStep {
  stepOrder: number;
  label: string;
  approverType: ApprovalPolicyStep["approverType"];
  candidateIds: string[];
}

export interface ResolveOptions {
  allowSelfApproval: boolean;
}

type StepDef = Pick<
  ApprovalPolicyStep,
  "stepOrder" | "label" | "approverType" | "approverUserId" | "approverRole"
>;

class Directory {
  private userCache = new Map<string, boolean>();
  private roleCache = new Map<UserRole, string[]>();
  private teamApprover: string | null | undefined;

  constructor(
    private readonly organizationId: string,
    private readonly requester: RequesterContext,
    private readonly db: Db
  ) {}

  async isActiveUser(userId: string | null): Promise<boolean> {
    if (!userId) return false;
    const cached = this.userCache.get(userId);
    if (cached !== undefined) return cached;
    const user = await this.db.user.findFirst({
      where: {
        id: userId,
        organizationId: this.organizationId,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    this.userCache.set(userId, Boolean(user));
    return Boolean(user);
  }

  async usersWithRole(role: UserRole): Promise<string[]> {
    const cached = this.roleCache.get(role);
    if (cached) return cached;
    const users = await this.db.user.findMany({
      where: { organizationId: this.organizationId, role, status: "ACTIVE" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    const ids = users.map((u) => u.id);
    this.roleCache.set(role, ids);
    return ids;
  }

  async manager(): Promise<string[]> {
    return (await this.isActiveUser(this.requester.managerId))
      ? [this.requester.managerId as string]
      : [];
  }

  async teamApproverIds(): Promise<string[]> {
    if (this.teamApprover === undefined) {
      if (!this.requester.teamId) {
        this.teamApprover = null;
      } else {
        const team = await this.db.team.findFirst({
          where: {
            id: this.requester.teamId,
            organizationId: this.organizationId,
          },
          select: { approverId: true },
        });
        this.teamApprover = team?.approverId ?? null;
      }
    }
    return (await this.isActiveUser(this.teamApprover))
      ? [this.teamApprover as string]
      : [];
  }

  admins(): Promise<string[]> {
    return this.usersWithRole("ADMIN");
  }
}

async function firstNonEmpty(
  sources: Array<() => Promise<string[]>>
): Promise<string[]> {
  for (const source of sources) {
    const ids = await source();
    if (ids.length > 0) return ids;
  }
  return [];
}

async function candidatesFor(step: StepDef, dir: Directory): Promise<string[]> {
  switch (step.approverType) {
    case "USER":
      return firstNonEmpty([
        async () =>
          (await dir.isActiveUser(step.approverUserId))
            ? [step.approverUserId as string]
            : [],
        () => dir.admins(),
      ]);
    case "MANAGER":
      return firstNonEmpty([
        () => dir.manager(),
        () => dir.teamApproverIds(),
        () => dir.admins(),
      ]);
    case "TEAM_APPROVER":
      return firstNonEmpty([
        () => dir.teamApproverIds(),
        () => dir.manager(),
        () => dir.admins(),
      ]);
    case "ROLE":
      return firstNonEmpty([
        async () =>
          step.approverRole ? dir.usersWithRole(step.approverRole) : [],
        () => dir.admins(),
      ]);
    default:
      return [];
  }
}

async function withoutRequester(
  ids: string[],
  requesterId: string,
  dir: Directory
): Promise<string[]> {
  const filtered = ids.filter((id) => id !== requesterId);
  if (filtered.length > 0) return filtered;
  return (await dir.admins()).filter((id) => id !== requesterId);
}

export async function resolveSteps(
  organizationId: string,
  steps: StepDef[],
  requester: RequesterContext,
  options: ResolveOptions,
  db: Db = prisma
): Promise<ResolvedStep[]> {
  const dir = new Directory(organizationId, requester, db);
  const ordered = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
  const resolved: ResolvedStep[] = [];
  for (const step of ordered) {
    let candidateIds = Array.from(new Set(await candidatesFor(step, dir)));
    if (!options.allowSelfApproval && candidateIds.includes(requester.id)) {
      candidateIds = await withoutRequester(candidateIds, requester.id, dir);
    }
    resolved.push({
      stepOrder: step.stepOrder,
      label: step.label,
      approverType: step.approverType,
      candidateIds,
    });
  }
  return resolved;
}

/** Users holding the escalation role from `approvals.escalateToRole`. */
export async function usersForEscalation(
  organizationId: string,
  role: "ADMIN" | "APPROVER",
  db: Db = prisma
): Promise<string[]> {
  const roles: UserRole[] =
    role === "ADMIN" ? ["ADMIN"] : ["APPROVER", "ADMIN"];
  const users = await db.user.findMany({
    where: { organizationId, role: { in: roles }, status: "ACTIVE" },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
