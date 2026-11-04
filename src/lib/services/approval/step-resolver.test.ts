// src/lib/services/approval/step-resolver.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveSteps, usersForEscalation } from "./step-resolver";

const prisma = vi.hoisted(() => ({
  user: { findFirst: vi.fn(), findMany: vi.fn() },
  team: { findFirst: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma }));

const ORG = "org";
const ACTIVE = new Set([
  "u-user",
  "u-mgr",
  "u-team",
  "admin-1",
  "admin-2",
  "fin-1",
  "fin-2",
]);

function step(
  approverType: "USER" | "MANAGER" | "TEAM_APPROVER" | "ROLE",
  extra: Partial<{
    approverUserId: string | null;
    approverRole: "ADMIN" | "APPROVER" | "MEMBER" | null;
  }> = {},
  stepOrder = 1
) {
  return {
    stepOrder,
    label: `Step ${stepOrder}`,
    approverType,
    approverUserId: extra.approverUserId ?? null,
    approverRole: extra.approverRole ?? null,
  };
}

describe("resolveSteps", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.user.findFirst.mockImplementation(async ({ where }) =>
      ACTIVE.has(where.id) ? { id: where.id } : null
    );
    prisma.user.findMany.mockImplementation(async ({ where }) => {
      if (where.role === "ADMIN") return [{ id: "admin-1" }, { id: "admin-2" }];
      if (where.role === "APPROVER") return [{ id: "fin-1" }, { id: "fin-2" }];
      return [];
    });
    prisma.team.findFirst.mockResolvedValue({ approverId: "u-team" });
  });

  const requester = { id: "u-req", managerId: "u-mgr", teamId: "team-1" };
  const opts = { allowSelfApproval: false };

  it("resolves a USER step to that user", async () => {
    const [s] = await resolveSteps(
      ORG,
      [step("USER", { approverUserId: "u-user" })],
      requester,
      opts
    );
    expect(s.candidateIds).toEqual(["u-user"]);
  });

  it("falls back to admins when the USER is inactive", async () => {
    const [s] = await resolveSteps(
      ORG,
      [step("USER", { approverUserId: "gone" })],
      requester,
      opts
    );
    expect(s.candidateIds).toEqual(["admin-1", "admin-2"]);
  });

  it("resolves MANAGER to the requester's manager", async () => {
    const [s] = await resolveSteps(ORG, [step("MANAGER")], requester, opts);
    expect(s.candidateIds).toEqual(["u-mgr"]);
  });

  it("MANAGER falls back to the team approver, then admins", async () => {
    const noManager = { ...requester, managerId: null };
    const [viaTeam] = await resolveSteps(
      ORG,
      [step("MANAGER")],
      noManager,
      opts
    );
    expect(viaTeam.candidateIds).toEqual(["u-team"]);

    prisma.team.findFirst.mockResolvedValue({ approverId: null });
    const [viaAdmins] = await resolveSteps(
      ORG,
      [step("MANAGER")],
      noManager,
      opts
    );
    expect(viaAdmins.candidateIds).toEqual(["admin-1", "admin-2"]);
  });

  it("resolves TEAM_APPROVER to the team's approver, falling back to the manager", async () => {
    const [s] = await resolveSteps(
      ORG,
      [step("TEAM_APPROVER")],
      requester,
      opts
    );
    expect(s.candidateIds).toEqual(["u-team"]);

    prisma.team.findFirst.mockResolvedValue(null);
    const [fallback] = await resolveSteps(
      ORG,
      [step("TEAM_APPROVER")],
      requester,
      opts
    );
    expect(fallback.candidateIds).toEqual(["u-mgr"]);
  });

  it("resolves ROLE to every active user with that role", async () => {
    const [s] = await resolveSteps(
      ORG,
      [step("ROLE", { approverRole: "APPROVER" })],
      requester,
      opts
    );
    expect(s.candidateIds).toEqual(["fin-1", "fin-2"]);
  });

  it("keeps step order and supports a manager → finance chain", async () => {
    const steps = await resolveSteps(
      ORG,
      [step("ROLE", { approverRole: "APPROVER" }, 2), step("MANAGER", {}, 1)],
      requester,
      opts
    );
    expect(steps.map((s) => s.stepOrder)).toEqual([1, 2]);
    expect(steps[0].candidateIds).toEqual(["u-mgr"]);
    expect(steps[1].candidateIds).toEqual(["fin-1", "fin-2"]);
  });

  it("removes the requester from candidates unless self-approval is allowed", async () => {
    const selfManaged = { id: "u-mgr", managerId: "u-mgr", teamId: null };
    const [blocked] = await resolveSteps(
      ORG,
      [step("MANAGER")],
      selfManaged,
      opts
    );
    expect(blocked.candidateIds).toEqual(["admin-1", "admin-2"]);

    const [allowed] = await resolveSteps(ORG, [step("MANAGER")], selfManaged, {
      allowSelfApproval: true,
    });
    expect(allowed.candidateIds).toEqual(["u-mgr"]);
  });

  it("marks a step as skipped (no candidates) when nobody can approve", async () => {
    prisma.user.findMany.mockResolvedValue([]);
    const [s] = await resolveSteps(
      ORG,
      [step("USER", { approverUserId: "u-req" })],
      { id: "u-req", managerId: null, teamId: null },
      opts
    );
    expect(s.candidateIds).toEqual([]);
  });
});

describe("usersForEscalation", () => {
  it("queries admins only, or approvers plus admins", async () => {
    prisma.user.findMany.mockResolvedValue([{ id: "a" }]);
    await usersForEscalation(ORG, "ADMIN");
    expect(prisma.user.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: { in: ["ADMIN"] } }),
      })
    );
    await usersForEscalation(ORG, "APPROVER");
    expect(prisma.user.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: { in: ["APPROVER", "ADMIN"] } }),
      })
    );
  });
});
